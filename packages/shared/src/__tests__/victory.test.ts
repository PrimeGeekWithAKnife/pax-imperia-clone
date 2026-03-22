/**
 * Tests for the victory conditions and score tracking engine.
 */

import { describe, it, expect } from 'vitest';

import {
  calculateVictoryProgress,
  checkVictoryConditions,
  updateEconomicLeadTicks,
  isGameOver,
  initializeTickState,
} from '../engine/index.js';
import type { GameState } from '../types/game-state.js';
import type { Empire, DiplomaticRelation } from '../types/species.js';
import type { EmpireResources } from '../types/resources.js';
import type { Galaxy, StarSystem } from '../types/galaxy.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEmpire(id: string, overrides: Partial<Empire> = {}): Empire {
  return {
    id,
    name: `Empire ${id}`,
    species: {
      id: `species_${id}`,
      name: `Species ${id}`,
      description: '',
      portrait: '',
      isPrebuilt: true,
      specialAbilities: [],
      traits: {
        construction: 5,
        reproduction: 5,
        research: 5,
        espionage: 5,
        economy: 5,
        combat: 5,
        diplomacy: 5,
      },
      environmentPreference: {
        idealTemperature: 288,
        temperatureTolerance: 50,
        idealGravity: 1.0,
        gravityTolerance: 0.4,
        preferredAtmospheres: ['oxygen_nitrogen'],
      },
    },
    color: '#ff0000',
    credits: 1000,
    researchPoints: 0,
    knownSystems: [],
    diplomacy: [],
    technologies: [],
    currentAge: 'nano_atomic',
    isAI: false,
    ...overrides,
  };
}

function makeRelation(empireId: string, status: DiplomaticRelation['status'] = 'neutral'): DiplomaticRelation {
  return {
    empireId,
    status,
    treaties: [],
    attitude: 0,
    tradeRoutes: 0,
  };
}

function makePlanet(id: string, ownerId: string | null, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Planet ${id}`,
    orbitalIndex: 0,
    type: 'terran' as const,
    atmosphere: 'oxygen_nitrogen' as const,
    gravity: 1.0,
    temperature: 288,
    naturalResources: 50,
    maxPopulation: 1_000_000,
    currentPopulation: ownerId ? 100_000 : 0,
    ownerId,
    buildings: [],
    productionQueue: [],
    ...overrides,
  };
}

function makeSystem(id: string, planets: ReturnType<typeof makePlanet>[]): StarSystem {
  return {
    id,
    name: `System ${id}`,
    position: { x: 0, y: 0 },
    starType: 'yellow',
    planets,
    wormholes: [],
    ownerId: planets.some(p => p.ownerId !== null) ? planets.find(p => p.ownerId)!.ownerId : null,
    discovered: {},
  };
}

function makeGalaxy(systems: StarSystem[]): Galaxy {
  return { id: 'galaxy', systems, width: 1000, height: 1000, seed: 1 };
}

function makeGameState(
  empires: Empire[],
  galaxy: Galaxy,
  overrides: Partial<GameState> = {},
): GameState {
  return {
    id: 'game',
    galaxy,
    empires,
    fleets: [],
    ships: [],
    currentTick: 0,
    speed: 'normal',
    status: 'playing',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// calculateVictoryProgress
// ---------------------------------------------------------------------------

describe('calculateVictoryProgress', () => {
  it('returns a progress object for a given empire', () => {
    const empire = makeEmpire('alpha');
    const galaxy = makeGalaxy([makeSystem('s1', [makePlanet('p1', 'alpha')])]);
    const gs = makeGameState([empire], galaxy);

    const progress = calculateVictoryProgress(empire, gs, gs.empires);

    expect(progress.empireId).toBe('alpha');
    expect(typeof progress.totalScore).toBe('number');
    expect(progress.victoryConditions).toHaveLength(4);
  });

  it('territorial score is 100 when empire owns all colonised planets', () => {
    const empire = makeEmpire('alpha');
    const galaxy = makeGalaxy([
      makeSystem('s1', [makePlanet('p1', 'alpha'), makePlanet('p2', 'alpha')]),
    ]);
    const gs = makeGameState([empire], galaxy);

    const progress = calculateVictoryProgress(empire, gs, gs.empires);

    expect(progress.scores.territorial).toBe(100);
  });

  it('territorial score is 0 when empire owns no planets', () => {
    const empire = makeEmpire('alpha');
    const rival = makeEmpire('beta');
    const galaxy = makeGalaxy([
      makeSystem('s1', [makePlanet('p1', 'beta')]),
    ]);
    const gs = makeGameState([empire, rival], galaxy);

    const progress = calculateVictoryProgress(empire, gs, gs.empires);

    expect(progress.scores.territorial).toBe(0);
  });

  it('technology score increases when techs are researched', () => {
    const basEmpire = makeEmpire('alpha');
    const advEmpire = makeEmpire('alpha', { technologies: ['tech_a', 'tech_b', 'tech_c'] });
    const galaxy = makeGalaxy([]);
    const gs = makeGameState([basEmpire], galaxy);

    const base = calculateVictoryProgress(basEmpire, gs, gs.empires);
    const adv = calculateVictoryProgress(advEmpire, gs, [advEmpire]);

    expect(adv.scores.technology).toBeGreaterThan(base.scores.technology);
  });

  it('diplomatic score increases with alliances', () => {
    const empire = makeEmpire('alpha');
    const alliedEmpire = makeEmpire('alpha', {
      diplomacy: [makeRelation('beta', 'allied')],
    });
    const galaxy = makeGalaxy([]);
    const gs = makeGameState([empire], galaxy);

    const base = calculateVictoryProgress(empire, gs, gs.empires);
    const allied = calculateVictoryProgress(alliedEmpire, gs, [alliedEmpire]);

    expect(allied.scores.diplomatic).toBeGreaterThan(base.scores.diplomatic);
  });

  it('economic score uses credits from resource map when provided', () => {
    const empire = makeEmpire('alpha', { credits: 0 });
    const galaxy = makeGalaxy([]);
    const gs = makeGameState([empire], galaxy);

    const resourcesMap = new Map<string, EmpireResources>([
      ['alpha', {
        credits: 999_999,
        minerals: 0,
        rareElements: 0,
        energy: 0,
        organics: 0,
        exoticMaterials: 0,
        faith: 0,
        researchPoints: 0,
      }],
    ]);

    const withMap = calculateVictoryProgress(empire, gs, gs.empires, resourcesMap);
    const withoutMap = calculateVictoryProgress(empire, gs, gs.empires);

    expect(withMap.scores.economic).toBeGreaterThan(withoutMap.scores.economic);
  });

  it('includes all four victory condition types', () => {
    const empire = makeEmpire('alpha');
    const galaxy = makeGalaxy([]);
    const gs = makeGameState([empire], galaxy);

    const progress = calculateVictoryProgress(empire, gs, gs.empires);
    const types = progress.victoryConditions.map(c => c.type);

    expect(types).toContain('conquest');
    expect(types).toContain('economic');
    expect(types).toContain('technological');
    expect(types).toContain('diplomatic');
  });
});

// ---------------------------------------------------------------------------
// checkVictoryConditions — conquest
// ---------------------------------------------------------------------------

describe('checkVictoryConditions — conquest', () => {
  it('returns null when no empire meets any condition', () => {
    const alpha = makeEmpire('alpha');
    const beta = makeEmpire('beta');
    // Each owns half the planets — neither has 75 %
    const galaxy = makeGalaxy([
      makeSystem('s1', [makePlanet('p1', 'alpha'), makePlanet('p2', 'beta')]),
    ]);
    const gs = makeGameState([alpha, beta], galaxy);

    expect(checkVictoryConditions(gs)).toBeNull();
  });

  it('triggers conquest victory when empire controls >= 75 % of colonised planets', () => {
    const alpha = makeEmpire('alpha');
    const beta = makeEmpire('beta');
    // alpha owns 3 out of 4 colonised = 75 %
    const galaxy = makeGalaxy([
      makeSystem('s1', [
        makePlanet('p1', 'alpha'),
        makePlanet('p2', 'alpha'),
        makePlanet('p3', 'alpha'),
        makePlanet('p4', 'beta'),
      ]),
    ]);
    const gs = makeGameState([alpha, beta], galaxy);

    const result = checkVictoryConditions(gs);
    expect(result).not.toBeNull();
    expect(result!.winner).toBe('alpha');
    expect(result!.condition).toBe('conquest');
  });

  it('does not trigger conquest when empire controls exactly 74 % (below threshold)', () => {
    const alpha = makeEmpire('alpha');
    const beta = makeEmpire('beta');
    // alpha owns 37 out of 50 = 74 %
    const planets = Array.from({ length: 50 }, (_, i) =>
      makePlanet(`p${i}`, i < 37 ? 'alpha' : 'beta'),
    );
    const galaxy = makeGalaxy([makeSystem('s1', planets)]);
    const gs = makeGameState([alpha, beta], galaxy);

    expect(checkVictoryConditions(gs)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// checkVictoryConditions — technological
// ---------------------------------------------------------------------------

describe('checkVictoryConditions — technological', () => {
  it('triggers technological victory when empire has researched ascension_project', () => {
    const alpha = makeEmpire('alpha', { technologies: ['ascension_project'] });
    const galaxy = makeGalaxy([]);
    const gs = makeGameState([alpha], galaxy);

    const result = checkVictoryConditions(gs);
    expect(result).not.toBeNull();
    expect(result!.winner).toBe('alpha');
    expect(result!.condition).toBe('technological');
  });

  it('does not trigger technological victory without ascension_project', () => {
    const alpha = makeEmpire('alpha', { technologies: ['basic_drives', 'ion_cannon'] });
    const galaxy = makeGalaxy([]);
    const gs = makeGameState([alpha], galaxy);

    expect(checkVictoryConditions(gs)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// checkVictoryConditions — diplomatic
// ---------------------------------------------------------------------------

describe('checkVictoryConditions — diplomatic', () => {
  it('triggers diplomatic victory when empire is allied with all others', () => {
    const alpha = makeEmpire('alpha', {
      diplomacy: [
        makeRelation('beta', 'allied'),
        makeRelation('gamma', 'allied'),
      ],
    });
    const beta = makeEmpire('beta');
    const gamma = makeEmpire('gamma');
    const galaxy = makeGalaxy([]);
    const gs = makeGameState([alpha, beta, gamma], galaxy);

    const result = checkVictoryConditions(gs);
    expect(result).not.toBeNull();
    expect(result!.winner).toBe('alpha');
    expect(result!.condition).toBe('diplomatic');
  });

  it('does not trigger diplomatic victory when one empire is not allied', () => {
    const alpha = makeEmpire('alpha', {
      diplomacy: [
        makeRelation('beta', 'allied'),
        makeRelation('gamma', 'neutral'), // not allied
      ],
    });
    const beta = makeEmpire('beta');
    const gamma = makeEmpire('gamma');
    const galaxy = makeGalaxy([]);
    const gs = makeGameState([alpha, beta, gamma], galaxy);

    expect(checkVictoryConditions(gs)).toBeNull();
  });

  it('triggers diplomatic victory in a two-empire game when the only rival is allied', () => {
    const alpha = makeEmpire('alpha', {
      diplomacy: [makeRelation('beta', 'allied')],
    });
    const beta = makeEmpire('beta');
    const galaxy = makeGalaxy([]);
    const gs = makeGameState([alpha, beta], galaxy);

    const result = checkVictoryConditions(gs);
    expect(result).not.toBeNull();
    expect(result!.winner).toBe('alpha');
    expect(result!.condition).toBe('diplomatic');
  });
});

// ---------------------------------------------------------------------------
// checkVictoryConditions — economic
// ---------------------------------------------------------------------------

describe('checkVictoryConditions — economic', () => {
  it('triggers economic victory when lead counter reaches threshold', () => {
    const alpha = makeEmpire('alpha');
    const beta = makeEmpire('beta');
    const galaxy = makeGalaxy([]);
    const gs = makeGameState([alpha, beta], galaxy);

    const resourcesMap = new Map<string, EmpireResources>([
      ['alpha', { credits: 100_000, minerals: 0, rareElements: 0, energy: 0, organics: 0, exoticMaterials: 0, faith: 0, researchPoints: 0 }],
      ['beta',  { credits:   5_000, minerals: 0, rareElements: 0, energy: 0, organics: 0, exoticMaterials: 0, faith: 0, researchPoints: 0 }],
    ]);

    // Simulate 50 ticks of sustained lead
    const leadTicks = new Map<string, number>([['alpha', 50], ['beta', 0]]);

    const result = checkVictoryConditions(gs, resourcesMap, leadTicks, 0);
    expect(result).not.toBeNull();
    expect(result!.winner).toBe('alpha');
    expect(result!.condition).toBe('economic');
  });

  it('does not trigger economic victory with only 49 ticks of lead', () => {
    const alpha = makeEmpire('alpha');
    const beta = makeEmpire('beta');
    const galaxy = makeGalaxy([]);
    const gs = makeGameState([alpha, beta], galaxy);

    const resourcesMap = new Map<string, EmpireResources>([
      ['alpha', { credits: 100_000, minerals: 0, rareElements: 0, energy: 0, organics: 0, exoticMaterials: 0, faith: 0, researchPoints: 0 }],
      ['beta',  { credits:   5_000, minerals: 0, rareElements: 0, energy: 0, organics: 0, exoticMaterials: 0, faith: 0, researchPoints: 0 }],
    ]);

    const leadTicks = new Map<string, number>([['alpha', 49], ['beta', 0]]);

    expect(checkVictoryConditions(gs, resourcesMap, leadTicks, 0)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// updateEconomicLeadTicks
// ---------------------------------------------------------------------------

describe('updateEconomicLeadTicks', () => {
  it('increments counter when empire maintains 10× credit lead', () => {
    const alpha = makeEmpire('alpha');
    const beta = makeEmpire('beta');

    const resourcesMap = new Map<string, EmpireResources>([
      ['alpha', { credits: 100_000, minerals: 0, rareElements: 0, energy: 0, organics: 0, exoticMaterials: 0, faith: 0, researchPoints: 0 }],
      ['beta',  { credits:   5_000, minerals: 0, rareElements: 0, energy: 0, organics: 0, exoticMaterials: 0, faith: 0, researchPoints: 0 }],
    ]);

    const prev = new Map<string, number>();
    const next = updateEconomicLeadTicks([alpha, beta], resourcesMap, prev);

    expect(next.get('alpha')).toBe(1);
    expect(next.get('beta')).toBe(0);
  });

  it('resets counter to 0 when lead is lost', () => {
    const alpha = makeEmpire('alpha');
    const beta = makeEmpire('beta');

    const resourcesMap = new Map<string, EmpireResources>([
      ['alpha', { credits: 5_000, minerals: 0, rareElements: 0, energy: 0, organics: 0, exoticMaterials: 0, faith: 0, researchPoints: 0 }],
      ['beta',  { credits: 5_000, minerals: 0, rareElements: 0, energy: 0, organics: 0, exoticMaterials: 0, faith: 0, researchPoints: 0 }],
    ]);

    const prev = new Map<string, number>([['alpha', 30], ['beta', 0]]);
    const next = updateEconomicLeadTicks([alpha, beta], resourcesMap, prev);

    // No 10× lead, so both reset to 0
    expect(next.get('alpha')).toBe(0);
    expect(next.get('beta')).toBe(0);
  });

  it('accumulates correctly over multiple calls', () => {
    const alpha = makeEmpire('alpha');
    const beta = makeEmpire('beta');

    const resourcesMap = new Map<string, EmpireResources>([
      ['alpha', { credits: 100_000, minerals: 0, rareElements: 0, energy: 0, organics: 0, exoticMaterials: 0, faith: 0, researchPoints: 0 }],
      ['beta',  { credits:   5_000, minerals: 0, rareElements: 0, energy: 0, organics: 0, exoticMaterials: 0, faith: 0, researchPoints: 0 }],
    ]);

    let ticks = new Map<string, number>();
    for (let i = 0; i < 10; i++) {
      ticks = updateEconomicLeadTicks([alpha, beta], resourcesMap, ticks);
    }

    expect(ticks.get('alpha')).toBe(10);
    expect(ticks.get('beta')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// isGameOver — integration with GameTickState
// ---------------------------------------------------------------------------

describe('isGameOver (via GameTickState)', () => {
  it('returns over=false for a fresh game state with no winner', () => {
    const alpha = makeEmpire('alpha');
    const beta = makeEmpire('beta');
    // Split planets — no conquest victory
    const galaxy = makeGalaxy([
      makeSystem('s1', [makePlanet('p1', 'alpha'), makePlanet('p2', 'beta')]),
    ]);
    const gs = makeGameState([alpha, beta], galaxy);
    const ts = initializeTickState(gs);

    expect(isGameOver(ts).over).toBe(false);
  });

  it('returns over=true when conquest threshold is met', () => {
    const alpha = makeEmpire('alpha');
    const beta = makeEmpire('beta');
    // alpha owns 3 out of 4 planets (75 %)
    const galaxy = makeGalaxy([
      makeSystem('s1', [
        makePlanet('p1', 'alpha'),
        makePlanet('p2', 'alpha'),
        makePlanet('p3', 'alpha'),
        makePlanet('p4', 'beta'),
      ]),
    ]);
    const gs = makeGameState([alpha, beta], galaxy);
    const ts = initializeTickState(gs);

    const result = isGameOver(ts);
    expect(result.over).toBe(true);
    expect(result.winnerId).toBe('alpha');
    expect(result.reason).toBe('conquest');
  });

  it('returns over=true when Ascension Project is researched', () => {
    const alpha = makeEmpire('alpha', { technologies: ['ascension_project'] });
    const galaxy = makeGalaxy([]);
    const gs = makeGameState([alpha], galaxy);
    const ts = initializeTickState(gs);

    const result = isGameOver(ts);
    expect(result.over).toBe(true);
    expect(result.winnerId).toBe('alpha');
    expect(result.reason).toBe('technological');
  });

  it('respects pre-set finished status', () => {
    const alpha = makeEmpire('alpha');
    const galaxy = makeGalaxy([]);
    const gs = makeGameState([alpha], galaxy, { status: 'finished' });
    const ts = initializeTickState(gs);

    const result = isGameOver(ts);
    expect(result.over).toBe(true);
    expect(result.reason).toBe('game_finished');
  });
});

// ---------------------------------------------------------------------------
// Conquest progress bar values
// ---------------------------------------------------------------------------

describe('conquest progress bar', () => {
  it('reports 100% progress when conquest is achieved', () => {
    const alpha = makeEmpire('alpha');
    const beta = makeEmpire('beta');
    const galaxy = makeGalaxy([
      makeSystem('s1', [
        makePlanet('p1', 'alpha'),
        makePlanet('p2', 'alpha'),
        makePlanet('p3', 'alpha'),
        makePlanet('p4', 'beta'),
      ]),
    ]);
    const gs = makeGameState([alpha, beta], galaxy);

    const progress = calculateVictoryProgress(alpha, gs, gs.empires);
    const conquest = progress.victoryConditions.find(c => c.type === 'conquest')!;

    expect(conquest.isAchieved).toBe(true);
    expect(conquest.progress).toBe(100);
  });

  it('reports partial progress proportional to planets owned', () => {
    const alpha = makeEmpire('alpha');
    const beta = makeEmpire('beta');
    // alpha owns 1 out of 4 = 25 %; threshold is 75 % → 33 % of the way to victory
    const galaxy = makeGalaxy([
      makeSystem('s1', [
        makePlanet('p1', 'alpha'),
        makePlanet('p2', 'beta'),
        makePlanet('p3', 'beta'),
        makePlanet('p4', 'beta'),
      ]),
    ]);
    const gs = makeGameState([alpha, beta], galaxy);

    const progress = calculateVictoryProgress(alpha, gs, gs.empires);
    const conquest = progress.victoryConditions.find(c => c.type === 'conquest')!;

    expect(conquest.isAchieved).toBe(false);
    expect(conquest.progress).toBeGreaterThan(0);
    expect(conquest.progress).toBeLessThan(100);
  });
});
