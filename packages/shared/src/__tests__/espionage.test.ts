import { describe, it, expect } from 'vitest';
import {
  initialiseEspionage,
  recruitSpy,
  assignMission,
  addAgentToState,
  processEspionageTick,
  recalculateCounterIntel,
  getSpyMissionLabel,
  getSpyStatusLabel,
  SPY_RECRUIT_COST,
  INFILTRATION_TICKS,
  STEAL_TECH_BASE_CHANCE,
  SABOTAGE_BASE_CHANCE,
  CAPTURE_ATTITUDE_PENALTY,
  COUNTER_INTEL_AGENT_GAIN,
  COMMS_HUB_COUNTER_INTEL_BONUS,
} from '../engine/espionage.js';
import type {
  SpyAgent,
  SpyMission,
  CaptureEvent,
  GatherIntelResult,
  StealTechResult,
  SabotageResult,
  CounterIntelResult,
} from '../engine/espionage.js';
import type { Empire, Species } from '../types/species.js';
import type { Planet, Building } from '../types/galaxy.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSpecies(espionageTrait = 5): Species {
  return {
    id: 'test_species',
    name: 'Test Species',
    description: '',
    portrait: '',
    isPrebuilt: true,
    specialAbilities: [],
    environmentPreference: {
      idealTemperature: 293,
      temperatureTolerance: 50,
      idealGravity: 1.0,
      gravityTolerance: 0.5,
      preferredAtmospheres: ['oxygen_nitrogen'],
    },
    traits: {
      construction: 5,
      reproduction: 5,
      research: 5,
      espionage: espionageTrait,
      economy: 5,
      combat: 5,
      diplomacy: 5,
    },
  };
}

function makeEmpire(id: string, overrides: Partial<Empire> = {}): Empire {
  return {
    id,
    name: `Empire ${id}`,
    species: makeSpecies(),
    color: '#ffffff',
    credits: 1000,
    researchPoints: 0,
    knownSystems: ['sys_a', 'sys_b'],
    diplomacy: [],
    technologies: ['pulse_lasers', 'ion_drives'],
    currentAge: 'nano_atomic',
    isAI: true,
    aiPersonality: 'diplomatic',
    government: 'representative_democracy',
    ...overrides,
  };
}

function makePlanet(buildingTypes: string[] = []): Planet {
  const buildings: Building[] = buildingTypes.map((type, i) => ({
    id: `b_${i}`,
    type: type as import('../types/galaxy.js').BuildingType,
    level: 1,
  }));
  return {
    id: 'planet_1',
    name: 'Test Planet',
    orbitalIndex: 1,
    type: 'terran',
    atmosphere: 'oxygen_nitrogen',
    gravity: 1.0,
    temperature: 293,
    naturalResources: 50,
    maxPopulation: 10,
    currentPopulation: 5,
    ownerId: 'alpha',
    buildings,
    productionQueue: [],
  };
}

/** PRNG that always returns the given value (for deterministic tests). */
function constantRng(value: number): () => number {
  return () => value;
}

/** PRNG that cycles through a sequence of values. */
function sequenceRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
}

function makeFullyActiveAgent(
  id = 'agent_1',
  mission: SpyMission = 'gather_intel',
  targetEmpireId = 'beta',
): SpyAgent {
  return {
    id,
    empireId: 'alpha',
    targetEmpireId,
    mission,
    skill: 5,
    turnsActive: INFILTRATION_TICKS, // already at the active threshold
    status: 'active',
  };
}

// ---------------------------------------------------------------------------
// initialiseEspionage
// ---------------------------------------------------------------------------

describe('initialiseEspionage', () => {
  it('creates counter-intel entries for every empire ID', () => {
    const state = initialiseEspionage(['alpha', 'beta', 'gamma']);
    expect(state.counterIntelLevel.has('alpha')).toBe(true);
    expect(state.counterIntelLevel.has('beta')).toBe(true);
    expect(state.counterIntelLevel.has('gamma')).toBe(true);
  });

  it('starts all counter-intel levels at 0', () => {
    const state = initialiseEspionage(['alpha', 'beta']);
    expect(state.counterIntelLevel.get('alpha')).toBe(0);
    expect(state.counterIntelLevel.get('beta')).toBe(0);
  });

  it('starts with an empty agent list', () => {
    const state = initialiseEspionage(['alpha']);
    expect(state.agents).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// recruitSpy
// ---------------------------------------------------------------------------

describe('recruitSpy', () => {
  it('creates an agent with skill matching the espionage trait', () => {
    const species = makeSpecies(7);
    const agent = recruitSpy('alpha', species);
    expect(agent.skill).toBe(7);
  });

  it('clamps skill to 1–10', () => {
    expect(recruitSpy('alpha', makeSpecies(0)).skill).toBe(1);
    expect(recruitSpy('alpha', makeSpecies(11)).skill).toBe(10);
  });

  it('assigns the correct empireId', () => {
    const agent = recruitSpy('alpha', makeSpecies());
    expect(agent.empireId).toBe('alpha');
  });

  it('starts in infiltrating status', () => {
    const agent = recruitSpy('alpha', makeSpecies());
    expect(agent.status).toBe('infiltrating');
  });

  it('starts with turnsActive 0', () => {
    const agent = recruitSpy('alpha', makeSpecies());
    expect(agent.turnsActive).toBe(0);
  });

  it('generates a unique ID each call', () => {
    const a = recruitSpy('alpha', makeSpecies());
    const b = recruitSpy('alpha', makeSpecies());
    expect(a.id).not.toBe(b.id);
  });

  it('recruit cost constant is 200 credits', () => {
    expect(SPY_RECRUIT_COST).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// assignMission
// ---------------------------------------------------------------------------

describe('assignMission', () => {
  it('sets the target empire and mission', () => {
    const agent = recruitSpy('alpha', makeSpecies());
    const assigned = assignMission(agent, 'beta', 'steal_tech');
    expect(assigned.targetEmpireId).toBe('beta');
    expect(assigned.mission).toBe('steal_tech');
  });

  it('resets turnsActive and status to infiltrating on reassignment', () => {
    const agent: SpyAgent = {
      ...recruitSpy('alpha', makeSpecies()),
      turnsActive: 10,
      status: 'active',
    };
    const reassigned = assignMission(agent, 'gamma', 'sabotage');
    expect(reassigned.turnsActive).toBe(0);
    expect(reassigned.status).toBe('infiltrating');
  });

  it('does not mutate the original agent', () => {
    const agent = recruitSpy('alpha', makeSpecies());
    const originalStatus = agent.status;
    assignMission(agent, 'beta', 'sabotage');
    expect(agent.status).toBe(originalStatus);
  });
});

// ---------------------------------------------------------------------------
// addAgentToState
// ---------------------------------------------------------------------------

describe('addAgentToState', () => {
  it('appends the agent to the state', () => {
    const state = initialiseEspionage(['alpha', 'beta']);
    const agent = recruitSpy('alpha', makeSpecies());
    const next = addAgentToState(state, agent);
    expect(next.agents).toHaveLength(1);
    expect(next.agents[0]!.id).toBe(agent.id);
  });

  it('does not mutate the original state', () => {
    const state = initialiseEspionage(['alpha']);
    const agent = recruitSpy('alpha', makeSpecies());
    addAgentToState(state, agent);
    expect(state.agents).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// recalculateCounterIntel
// ---------------------------------------------------------------------------

describe('recalculateCounterIntel', () => {
  it('returns 0 when there are no communications_hub buildings', () => {
    const state = initialiseEspionage(['alpha']);
    const planet = makePlanet(['factory', 'research_lab']);
    const next = recalculateCounterIntel(state, 'alpha', [planet]);
    expect(next.counterIntelLevel.get('alpha')).toBe(0);
  });

  it('adds COMMS_HUB_COUNTER_INTEL_BONUS per hub', () => {
    const state = initialiseEspionage(['alpha']);
    const planet = makePlanet(['communications_hub', 'communications_hub']);
    const next = recalculateCounterIntel(state, 'alpha', [planet]);
    expect(next.counterIntelLevel.get('alpha')).toBe(COMMS_HUB_COUNTER_INTEL_BONUS * 2);
  });

  it('clamps counter-intel to 100', () => {
    const state = initialiseEspionage(['alpha']);
    // 21 hubs × 5 = 105, should be capped at 100
    const hubs = Array.from({ length: 21 }, () => 'communications_hub');
    const planet = makePlanet(hubs);
    const next = recalculateCounterIntel(state, 'alpha', [planet]);
    expect(next.counterIntelLevel.get('alpha')).toBe(100);
  });

  it('does not mutate the original state', () => {
    const state = initialiseEspionage(['alpha']);
    const planet = makePlanet(['communications_hub']);
    recalculateCounterIntel(state, 'alpha', [planet]);
    expect(state.counterIntelLevel.get('alpha')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// processEspionageTick — infiltration phase
// ---------------------------------------------------------------------------

describe('processEspionageTick — infiltration', () => {
  it('increments turnsActive each tick', () => {
    const state = initialiseEspionage(['alpha', 'beta']);
    const agent = assignMission(recruitSpy('alpha', makeSpecies()), 'beta', 'gather_intel');
    const stateWithAgent = addAgentToState(state, agent);
    const { state: next } = processEspionageTick(stateWithAgent, [], constantRng(0));
    expect(next.agents[0]!.turnsActive).toBe(1);
  });

  it('keeps status as infiltrating while turnsActive < INFILTRATION_TICKS', () => {
    let currentState = initialiseEspionage(['alpha', 'beta']);
    const agent = assignMission(recruitSpy('alpha', makeSpecies()), 'beta', 'gather_intel');
    currentState = addAgentToState(currentState, agent);

    for (let t = 0; t < INFILTRATION_TICKS - 1; t++) {
      const result = processEspionageTick(currentState, [], constantRng(0));
      currentState = result.state;
    }
    expect(currentState.agents[0]!.status).toBe('infiltrating');
    expect(currentState.agents[0]!.turnsActive).toBe(INFILTRATION_TICKS - 1);
  });

  it('transitions to active on the tick turnsActive reaches INFILTRATION_TICKS', () => {
    let currentState = initialiseEspionage(['alpha', 'beta']);
    const agent = assignMission(recruitSpy('alpha', makeSpecies()), 'beta', 'gather_intel');
    currentState = addAgentToState(currentState, agent);

    // Advance agent to one tick before becoming active
    currentState.agents[0]!.turnsActive = INFILTRATION_TICKS - 1;

    const { state: next } = processEspionageTick(currentState, [], constantRng(0));
    expect(next.agents[0]!.status).toBe('active');
  });

  it('emits no mission events while infiltrating', () => {
    const state = initialiseEspionage(['alpha', 'beta']);
    const agent = assignMission(recruitSpy('alpha', makeSpecies()), 'beta', 'gather_intel');
    const stateWithAgent = addAgentToState(state, agent);
    const { events } = processEspionageTick(stateWithAgent, [], constantRng(0));
    expect(events).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// processEspionageTick — capture
// ---------------------------------------------------------------------------

describe('processEspionageTick — capture', () => {
  it('captures the agent when the detection roll succeeds', () => {
    const state = initialiseEspionage(['alpha', 'beta']);
    state.counterIntelLevel.set('beta', 100); // maximum counter-intel

    const agent = makeFullyActiveAgent();
    const stateWithAgent = addAgentToState(state, agent);

    // rng returns 0 → detection roll is 0, which is < risk → captured
    const { state: next, events } = processEspionageTick(
      stateWithAgent,
      [makeEmpire('alpha'), makeEmpire('beta')],
      constantRng(0),
    );

    expect(next.agents[0]!.status).toBe('captured');
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('capture');
  });

  it('capture event contains the correct empire IDs', () => {
    const state = initialiseEspionage(['alpha', 'beta']);
    state.counterIntelLevel.set('beta', 100);
    const agent = makeFullyActiveAgent();
    const stateWithAgent = addAgentToState(state, agent);

    const { events } = processEspionageTick(
      stateWithAgent,
      [makeEmpire('alpha'), makeEmpire('beta')],
      constantRng(0),
    );

    const capture = events[0] as CaptureEvent;
    expect(capture.empireId).toBe('alpha');
    expect(capture.targetEmpireId).toBe('beta');
  });

  it('capture event has the expected attitude penalty', () => {
    const state = initialiseEspionage(['alpha', 'beta']);
    state.counterIntelLevel.set('beta', 100);
    const agent = makeFullyActiveAgent();
    const stateWithAgent = addAgentToState(state, agent);

    const { events } = processEspionageTick(
      stateWithAgent,
      [makeEmpire('alpha'), makeEmpire('beta')],
      constantRng(0),
    );

    const capture = events[0] as CaptureEvent;
    expect(capture.attitudePenalty).toBe(CAPTURE_ATTITUDE_PENALTY);
    expect(CAPTURE_ATTITUDE_PENALTY).toBeLessThan(0);
  });

  it('does not emit a mission event when the agent is captured', () => {
    const state = initialiseEspionage(['alpha', 'beta']);
    state.counterIntelLevel.set('beta', 100);
    const agent = makeFullyActiveAgent('a1', 'steal_tech');
    const stateWithAgent = addAgentToState(state, agent);

    const { events } = processEspionageTick(
      stateWithAgent,
      [makeEmpire('alpha'), makeEmpire('beta')],
      constantRng(0),
    );

    // Only the capture event, no steal_tech event
    expect(events.every((e) => e.type === 'capture')).toBe(true);
  });

  it('does not detect an agent when counter-intel is 0', () => {
    const state = initialiseEspionage(['alpha', 'beta']);
    state.counterIntelLevel.set('beta', 0);
    const agent = makeFullyActiveAgent();
    const stateWithAgent = addAgentToState(state, agent);

    // Any rng value → detection risk is 0 → never captured
    const { state: next } = processEspionageTick(
      stateWithAgent,
      [makeEmpire('alpha'), makeEmpire('beta')],
      constantRng(0),
    );

    expect(next.agents[0]!.status).toBe('active');
  });
});

// ---------------------------------------------------------------------------
// processEspionageTick — gather_intel mission
// ---------------------------------------------------------------------------

describe('processEspionageTick — gather_intel', () => {
  it('emits a gather_intel event when the agent is active and not caught', () => {
    const state = initialiseEspionage(['alpha', 'beta']);
    // counter-intel 0 → no detection; rng 0.99 → below no threshold either
    const agent = makeFullyActiveAgent('a1', 'gather_intel', 'beta');
    const stateWithAgent = addAgentToState(state, agent);
    const targetEmpire = makeEmpire('beta');

    const { events } = processEspionageTick(
      stateWithAgent,
      [makeEmpire('alpha'), targetEmpire],
      constantRng(0.99), // will not trigger detection (risk is 0) nor skip missions
    );

    expect(events.some((e) => e.type === 'gather_intel')).toBe(true);
  });

  it('reveals target empire credits and tech count', () => {
    const state = initialiseEspionage(['alpha', 'beta']);
    const agent = makeFullyActiveAgent('a1', 'gather_intel', 'beta');
    const stateWithAgent = addAgentToState(state, agent);
    const targetEmpire = makeEmpire('beta', { credits: 2500, technologies: ['pulse_lasers', 'composite_armour', 'ion_drives'] });

    const { events } = processEspionageTick(
      stateWithAgent,
      [makeEmpire('alpha'), targetEmpire],
      constantRng(0.99),
    );

    const intelEvent = events.find((e) => e.type === 'gather_intel') as GatherIntelResult | undefined;
    expect(intelEvent).toBeDefined();
    expect(intelEvent!.credits).toBe(2500);
    expect(intelEvent!.techCount).toBe(3);
  });

  it('includes target empire known systems as fleet position data', () => {
    const state = initialiseEspionage(['alpha', 'beta']);
    const agent = makeFullyActiveAgent('a1', 'gather_intel', 'beta');
    const stateWithAgent = addAgentToState(state, agent);
    const targetEmpire = makeEmpire('beta', { knownSystems: ['sol', 'proxima', 'kepler'] });

    const { events } = processEspionageTick(
      stateWithAgent,
      [makeEmpire('alpha'), targetEmpire],
      constantRng(0.99),
    );

    const intelEvent = events.find((e) => e.type === 'gather_intel') as GatherIntelResult | undefined;
    expect(intelEvent!.fleetSystemIds).toEqual(['sol', 'proxima', 'kepler']);
  });
});

// ---------------------------------------------------------------------------
// processEspionageTick — steal_tech mission
// ---------------------------------------------------------------------------

describe('processEspionageTick — steal_tech', () => {
  it('emits a steal_tech event with a stolen tech ID when the roll succeeds', () => {
    // counter-intel 0 → no detection; rng < STEAL_TECH_BASE_CHANCE → steal succeeds
    const state = initialiseEspionage(['alpha', 'beta']);
    const agent = makeFullyActiveAgent('a1', 'steal_tech', 'beta');
    const stateWithAgent = addAgentToState(state, agent);

    const targetEmpire = makeEmpire('beta', { technologies: ['plasma_cannons', 'deflector_shields'] });
    const ownerEmpire = makeEmpire('alpha', { technologies: [] });

    // sequence: first call is detection roll (0.99 → no detection), second is steal roll (0.01 → succeeds)
    const { events } = processEspionageTick(
      stateWithAgent,
      [ownerEmpire, targetEmpire],
      sequenceRng([0.99, 0.01]),
    );

    const stealEvent = events.find((e) => e.type === 'steal_tech') as StealTechResult | undefined;
    expect(stealEvent).toBeDefined();
    expect(stealEvent!.stolenTechId).not.toBeNull();
  });

  it('emits no steal_tech event when the roll fails', () => {
    const state = initialiseEspionage(['alpha', 'beta']);
    const agent = makeFullyActiveAgent('a1', 'steal_tech', 'beta');
    const stateWithAgent = addAgentToState(state, agent);

    const targetEmpire = makeEmpire('beta', { technologies: ['plasma_cannons'] });
    const ownerEmpire = makeEmpire('alpha', { technologies: [] });

    // detection 0.99 (miss), steal 0.99 (miss — above STEAL_TECH_BASE_CHANCE)
    const { events } = processEspionageTick(
      stateWithAgent,
      [ownerEmpire, targetEmpire],
      constantRng(0.99),
    );

    expect(events.some((e) => e.type === 'steal_tech')).toBe(false);
  });

  it('does not steal a tech the owner already has', () => {
    const state = initialiseEspionage(['alpha', 'beta']);
    const agent = makeFullyActiveAgent('a1', 'steal_tech', 'beta');
    const stateWithAgent = addAgentToState(state, agent);

    // Both empires have the same single tech
    const sharedTech = 'pulse_lasers';
    const targetEmpire = makeEmpire('beta', { technologies: [sharedTech] });
    const ownerEmpire = makeEmpire('alpha', { technologies: [sharedTech] });

    const { events } = processEspionageTick(
      stateWithAgent,
      [ownerEmpire, targetEmpire],
      sequenceRng([0.99, 0.01]), // roll succeeds but nothing stealable
    );

    const stealEvent = events.find((e) => e.type === 'steal_tech') as StealTechResult | undefined;
    // Either no event emitted, or stolenTechId is null
    if (stealEvent) {
      expect(stealEvent.stolenTechId).toBeNull();
    }
  });

  it('steal chance is reduced by counter-intel', () => {
    // This tests that the counter-intel factor reduces the probability.
    // With counter-intel 100, adjustedChance = BASE * 0.5 = 0.15
    // So a roll of 0.20 should fail with high counter-intel but succeed without.
    const testRoll = 0.20;

    // No counter-intel: base chance 0.30 → roll 0.20 succeeds
    const stateNoCi = initialiseEspionage(['alpha', 'beta']);
    const agentNoCi = makeFullyActiveAgent('a1', 'steal_tech', 'beta');
    const { events: eventsNoCi } = processEspionageTick(
      addAgentToState(stateNoCi, agentNoCi),
      [makeEmpire('alpha', { technologies: [] }), makeEmpire('beta', { technologies: ['plasma_cannons'] })],
      sequenceRng([0.99, testRoll]),
    );
    expect(eventsNoCi.some((e) => e.type === 'steal_tech')).toBe(true);

    // High counter-intel: adjusted chance 0.15 → roll 0.20 fails
    const stateHighCi = initialiseEspionage(['alpha', 'beta']);
    stateHighCi.counterIntelLevel.set('beta', 100);
    const agentHighCi = makeFullyActiveAgent('a2', 'steal_tech', 'beta');
    const { events: eventsHighCi } = processEspionageTick(
      addAgentToState(stateHighCi, agentHighCi),
      [makeEmpire('alpha', { technologies: [] }), makeEmpire('beta', { technologies: ['plasma_cannons'] })],
      sequenceRng([0.99, testRoll]),
    );
    expect(eventsHighCi.some((e) => e.type === 'steal_tech')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// processEspionageTick — sabotage mission
// ---------------------------------------------------------------------------

describe('processEspionageTick — sabotage', () => {
  it('emits a sabotage event when the roll succeeds', () => {
    const state = initialiseEspionage(['alpha', 'beta']);
    const agent = makeFullyActiveAgent('a1', 'sabotage', 'beta');
    const stateWithAgent = addAgentToState(state, agent);

    // detection 0.99 (miss), sabotage 0.01 (succeeds — below BASE_CHANCE 0.20)
    const { events } = processEspionageTick(
      stateWithAgent,
      [makeEmpire('alpha'), makeEmpire('beta')],
      sequenceRng([0.99, 0.01]),
    );

    expect(events.some((e) => e.type === 'sabotage')).toBe(true);
  });

  it('emits no sabotage event when the roll fails', () => {
    const state = initialiseEspionage(['alpha', 'beta']);
    const agent = makeFullyActiveAgent('a1', 'sabotage', 'beta');
    const stateWithAgent = addAgentToState(state, agent);

    // both rolls high → no detection, no sabotage
    const { events } = processEspionageTick(
      stateWithAgent,
      [makeEmpire('alpha'), makeEmpire('beta')],
      constantRng(0.99),
    );

    expect(events.some((e) => e.type === 'sabotage')).toBe(false);
  });

  it('sabotage event contains the correct agentId and targetEmpireId', () => {
    const state = initialiseEspionage(['alpha', 'beta']);
    const agent = makeFullyActiveAgent('my_agent', 'sabotage', 'beta');
    const stateWithAgent = addAgentToState(state, agent);

    const { events } = processEspionageTick(
      stateWithAgent,
      [makeEmpire('alpha'), makeEmpire('beta')],
      sequenceRng([0.99, 0.01]),
    );

    const sabEvent = events.find((e) => e.type === 'sabotage') as SabotageResult | undefined;
    expect(sabEvent!.agentId).toBe('my_agent');
    expect(sabEvent!.targetEmpireId).toBe('beta');
  });
});

// ---------------------------------------------------------------------------
// processEspionageTick — counter_intel mission
// ---------------------------------------------------------------------------

describe('processEspionageTick — counter_intel', () => {
  it('emits a counter_intel event and increases the empire level', () => {
    const state = initialiseEspionage(['alpha', 'beta']);
    const agent = makeFullyActiveAgent('a1', 'counter_intel', 'beta');
    const stateWithAgent = addAgentToState(state, agent);

    const { state: next, events } = processEspionageTick(
      stateWithAgent,
      [makeEmpire('alpha'), makeEmpire('beta')],
      constantRng(0.99),
    );

    expect(events.some((e) => e.type === 'counter_intel')).toBe(true);
    const ciEvent = events.find((e) => e.type === 'counter_intel') as CounterIntelResult;
    expect(ciEvent.empireId).toBe('alpha');
    expect(ciEvent.levelIncrease).toBe(COUNTER_INTEL_AGENT_GAIN);
    expect(next.counterIntelLevel.get('alpha')).toBe(COUNTER_INTEL_AGENT_GAIN);
  });

  it('clamps the counter-intel level to 100', () => {
    const state = initialiseEspionage(['alpha', 'beta']);
    state.counterIntelLevel.set('alpha', 99);
    const agent = makeFullyActiveAgent('a1', 'counter_intel', 'beta');
    const stateWithAgent = addAgentToState(state, agent);

    // Agent gain is 3; 99 + 3 = 102 → clamp to 100
    const { state: next } = processEspionageTick(
      stateWithAgent,
      [makeEmpire('alpha'), makeEmpire('beta')],
      constantRng(0.99),
    );

    expect(next.counterIntelLevel.get('alpha')).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// processEspionageTick — state immutability
// ---------------------------------------------------------------------------

describe('processEspionageTick — immutability', () => {
  it('does not mutate the original state', () => {
    const state = initialiseEspionage(['alpha', 'beta']);
    const agent = makeFullyActiveAgent();
    const stateWithAgent = addAgentToState(state, agent);
    const originalTurns = stateWithAgent.agents[0]!.turnsActive;

    processEspionageTick(stateWithAgent, [makeEmpire('alpha'), makeEmpire('beta')], constantRng(0.99));

    expect(stateWithAgent.agents[0]!.turnsActive).toBe(originalTurns);
  });
});

// ---------------------------------------------------------------------------
// processEspionageTick — skipping concluded agents
// ---------------------------------------------------------------------------

describe('processEspionageTick — concluded agents are skipped', () => {
  it('does not process captured agents', () => {
    const state = initialiseEspionage(['alpha', 'beta']);
    const agent: SpyAgent = { ...makeFullyActiveAgent(), status: 'captured' };
    const stateWithAgent = addAgentToState(state, agent);

    const { state: next } = processEspionageTick(
      stateWithAgent,
      [makeEmpire('alpha'), makeEmpire('beta')],
      constantRng(0.99),
    );

    // turnsActive should not have changed
    expect(next.agents[0]!.turnsActive).toBe(agent.turnsActive);
  });

  it('does not process returned agents', () => {
    const state = initialiseEspionage(['alpha', 'beta']);
    const agent: SpyAgent = { ...makeFullyActiveAgent(), status: 'returned' };
    const stateWithAgent = addAgentToState(state, agent);

    const { state: next } = processEspionageTick(
      stateWithAgent,
      [makeEmpire('alpha'), makeEmpire('beta')],
      constantRng(0.99),
    );

    expect(next.agents[0]!.turnsActive).toBe(agent.turnsActive);
  });
});

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

describe('getSpyMissionLabel', () => {
  it('returns readable labels for all mission types', () => {
    expect(getSpyMissionLabel('gather_intel')).toBe('Gather Intelligence');
    expect(getSpyMissionLabel('steal_tech')).toBe('Steal Technology');
    expect(getSpyMissionLabel('sabotage')).toBe('Sabotage');
    expect(getSpyMissionLabel('counter_intel')).toBe('Counter-Intelligence');
  });
});

describe('getSpyStatusLabel', () => {
  it('returns readable labels for all status values', () => {
    expect(getSpyStatusLabel('infiltrating')).toBe('Infiltrating');
    expect(getSpyStatusLabel('active')).toBe('Active');
    expect(getSpyStatusLabel('captured')).toBe('Captured');
    expect(getSpyStatusLabel('returned')).toBe('Returned');
  });
});

// ---------------------------------------------------------------------------
// Constants sanity checks
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('INFILTRATION_TICKS is 5', () => {
    expect(INFILTRATION_TICKS).toBe(5);
  });

  it('STEAL_TECH_BASE_CHANCE is 0.30', () => {
    expect(STEAL_TECH_BASE_CHANCE).toBe(0.30);
  });

  it('SABOTAGE_BASE_CHANCE is 0.20', () => {
    expect(SABOTAGE_BASE_CHANCE).toBe(0.20);
  });

  it('COMMS_HUB_COUNTER_INTEL_BONUS is positive', () => {
    expect(COMMS_HUB_COUNTER_INTEL_BONUS).toBeGreaterThan(0);
  });
});
