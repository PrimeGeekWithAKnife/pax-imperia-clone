import { describe, it, expect } from 'vitest';
import {
  getAvailableTechs,
  startResearch,
  setResearchAllocation,
  processResearchTick,
  canAdvanceAge,
  getResearchSpeed,
  applyTechEffects,
} from '../engine/research.js';
import type { Technology, ResearchState } from '../engine/research.js';
import type { Empire, Species } from '../types/species.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/**
 * Minimal mock tech tree:
 *
 *   [nano_atomic]
 *     basic_propulsion   (no prereqs)
 *     basic_weapons      (no prereqs)
 *     basic_shields      (requires basic_propulsion)
 *     fusion_theory      (requires basic_propulsion + basic_weapons)  -> unlocks fusion
 *
 *   [fusion]
 *     advanced_weapons   (requires basic_weapons)
 *     wormhole_nav       (requires fusion_theory)
 *     advanced_shields   (requires basic_shields, advanced_weapons)   -> unlocks nano_fusion
 */
const MOCK_TECHS: Technology[] = [
  {
    id: 'basic_propulsion',
    name: 'Basic Propulsion',
    description: 'Rudimentary drive technology',
    category: 'propulsion',
    age: 'nano_atomic',
    cost: 100,
    prerequisites: [],
    effects: [],
  },
  {
    id: 'basic_weapons',
    name: 'Basic Weapons',
    description: 'Simple energy weapons',
    category: 'weapons',
    age: 'nano_atomic',
    cost: 80,
    prerequisites: [],
    effects: [{ type: 'stat_bonus', stat: 'combat', value: 2 }],
  },
  {
    id: 'basic_shields',
    name: 'Basic Shields',
    description: 'Energy shielding',
    category: 'defense',
    age: 'nano_atomic',
    cost: 120,
    prerequisites: ['basic_propulsion'],
    effects: [{ type: 'unlock_component', componentId: 'shield_mk1' }],
  },
  {
    id: 'fusion_theory',
    name: 'Fusion Theory',
    description: 'Theoretical framework for the fusion age',
    category: 'racial',
    age: 'nano_atomic',
    cost: 200,
    prerequisites: ['basic_propulsion', 'basic_weapons'],
    effects: [{ type: 'age_unlock', age: 'fusion' }],
  },
  {
    id: 'advanced_weapons',
    name: 'Advanced Weapons',
    description: 'Improved energy weapons',
    category: 'weapons',
    age: 'fusion',
    cost: 150,
    prerequisites: ['basic_weapons'],
    effects: [
      { type: 'stat_bonus', stat: 'combat', value: 5 },
      { type: 'unlock_hull', hullClass: 'destroyer' },
    ],
  },
  {
    id: 'wormhole_nav',
    name: 'Wormhole Navigation',
    description: 'Navigate through wormholes efficiently',
    category: 'propulsion',
    age: 'fusion',
    cost: 180,
    prerequisites: ['fusion_theory'],
    effects: [{ type: 'enable_ability', ability: 'wormhole_travel' }],
  },
  {
    id: 'advanced_shields',
    name: 'Advanced Shields',
    description: 'Next-generation shielding',
    category: 'defense',
    age: 'fusion',
    cost: 300,
    prerequisites: ['basic_shields', 'advanced_weapons'],
    effects: [
      { type: 'resource_bonus', resource: 'researchPoints', multiplier: 1.1 },
      { type: 'age_unlock', age: 'nano_fusion' },
    ],
  },
];

function makeSpecies(researchTrait = 5): Species {
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
      research: researchTrait,
      espionage: 5,
      economy: 5,
      combat: 5,
      diplomacy: 5,
    },
  };
}

function makeEmpire(overrides: Partial<Empire> = {}): Empire {
  const species = makeSpecies();
  return {
    id: 'empire-1',
    name: 'Test Empire',
    species,
    color: '#0000ff',
    credits: 1000,
    researchPoints: 0,
    knownSystems: [],
    diplomacy: [],
    technologies: [],
    currentAge: 'nano_atomic',
    isAI: false,
    government: 'democracy',
    ...overrides,
  };
}

function makeResearchState(overrides: Partial<ResearchState> = {}): ResearchState {
  return {
    completedTechs: [],
    activeResearch: [],
    currentAge: 'nano_atomic',
    totalResearchGenerated: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getAvailableTechs
// ---------------------------------------------------------------------------

describe('getAvailableTechs', () => {
  it('returns all techs with no prerequisites when starting fresh', () => {
    const state = makeResearchState();
    const available = getAvailableTechs(MOCK_TECHS, state);

    const ids = available.map(t => t.id);
    expect(ids).toContain('basic_propulsion');
    expect(ids).toContain('basic_weapons');
    // These have prerequisites
    expect(ids).not.toContain('basic_shields');
    expect(ids).not.toContain('fusion_theory');
  });

  it('unlocks techs once prerequisites are completed', () => {
    const state = makeResearchState({
      completedTechs: ['basic_propulsion'],
    });
    const available = getAvailableTechs(MOCK_TECHS, state);
    const ids = available.map(t => t.id);

    expect(ids).toContain('basic_shields');
    // fusion_theory still requires basic_weapons too
    expect(ids).not.toContain('fusion_theory');
  });

  it('unlocks multi-prerequisite tech when all prereqs are met', () => {
    const state = makeResearchState({
      completedTechs: ['basic_propulsion', 'basic_weapons'],
    });
    const available = getAvailableTechs(MOCK_TECHS, state);
    const ids = available.map(t => t.id);

    expect(ids).toContain('fusion_theory');
    expect(ids).toContain('basic_shields');
  });

  it('excludes already completed techs', () => {
    const state = makeResearchState({
      completedTechs: ['basic_propulsion'],
    });
    const available = getAvailableTechs(MOCK_TECHS, state);
    const ids = available.map(t => t.id);

    expect(ids).not.toContain('basic_propulsion');
  });

  it('excludes techs currently in activeResearch', () => {
    const state = makeResearchState({
      activeResearch: [{ techId: 'basic_weapons', pointsInvested: 0, allocation: 100 }],
    });
    const available = getAvailableTechs(MOCK_TECHS, state);
    const ids = available.map(t => t.id);

    expect(ids).not.toContain('basic_weapons');
  });

  it('respects age gates — fusion techs not available in nano_atomic age', () => {
    const state = makeResearchState({
      completedTechs: ['basic_weapons'],
      currentAge: 'nano_atomic',
    });
    const available = getAvailableTechs(MOCK_TECHS, state);
    const ids = available.map(t => t.id);

    expect(ids).not.toContain('advanced_weapons');
    expect(ids).not.toContain('wormhole_nav');
    expect(ids).not.toContain('advanced_shields');
  });

  it('age-gated techs become available once the age is unlocked', () => {
    const state = makeResearchState({
      completedTechs: ['basic_propulsion', 'basic_weapons', 'fusion_theory'],
      currentAge: 'fusion',
    });
    const available = getAvailableTechs(MOCK_TECHS, state);
    const ids = available.map(t => t.id);

    expect(ids).toContain('advanced_weapons');
    expect(ids).toContain('wormhole_nav');
  });
});

// ---------------------------------------------------------------------------
// startResearch
// ---------------------------------------------------------------------------

describe('startResearch', () => {
  it('adds a tech to activeResearch', () => {
    const state = makeResearchState();
    const next = startResearch(state, 'basic_propulsion', MOCK_TECHS, 50);

    expect(next.activeResearch).toHaveLength(1);
    expect(next.activeResearch[0].techId).toBe('basic_propulsion');
    expect(next.activeResearch[0].pointsInvested).toBe(0);
    expect(next.activeResearch[0].allocation).toBe(50);
  });

  it('does not mutate the original state', () => {
    const state = makeResearchState();
    startResearch(state, 'basic_propulsion', MOCK_TECHS, 100);

    expect(state.activeResearch).toHaveLength(0);
  });

  it('rejects a tech whose prerequisites are not met', () => {
    const state = makeResearchState(); // basic_propulsion not yet completed

    expect(() =>
      startResearch(state, 'basic_shields', MOCK_TECHS, 100),
    ).toThrow();
  });

  it('rejects a tech that is already completed', () => {
    const state = makeResearchState({
      completedTechs: ['basic_propulsion'],
    });

    expect(() =>
      startResearch(state, 'basic_propulsion', MOCK_TECHS, 100),
    ).toThrow();
  });

  it('rejects an allocation that would push total above 100%', () => {
    const state = makeResearchState({
      activeResearch: [{ techId: 'basic_propulsion', pointsInvested: 0, allocation: 60 }],
    });
    // Only 40% remaining, requesting 50%
    expect(() =>
      startResearch(state, 'basic_weapons', MOCK_TECHS, 50),
    ).toThrow();
  });

  it('allows exactly 100% total allocation across multiple projects', () => {
    const state = makeResearchState({
      activeResearch: [{ techId: 'basic_propulsion', pointsInvested: 0, allocation: 60 }],
    });
    const next = startResearch(state, 'basic_weapons', MOCK_TECHS, 40);

    expect(next.activeResearch).toHaveLength(2);
  });

  it('rejects age-gated techs', () => {
    const state = makeResearchState({
      completedTechs: ['basic_weapons'],
      currentAge: 'nano_atomic',
    });

    expect(() =>
      startResearch(state, 'advanced_weapons', MOCK_TECHS, 100),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// setResearchAllocation
// ---------------------------------------------------------------------------

describe('setResearchAllocation', () => {
  it('updates allocation percentages for active research', () => {
    const state = makeResearchState({
      activeResearch: [
        { techId: 'basic_propulsion', pointsInvested: 0, allocation: 50 },
        { techId: 'basic_weapons', pointsInvested: 10, allocation: 50 },
      ],
    });

    const next = setResearchAllocation(state, [
      { techId: 'basic_propulsion', allocation: 30 },
      { techId: 'basic_weapons', allocation: 70 },
    ]);

    const propulsion = next.activeResearch.find(r => r.techId === 'basic_propulsion')!;
    const weapons = next.activeResearch.find(r => r.techId === 'basic_weapons')!;
    expect(propulsion.allocation).toBe(30);
    expect(weapons.allocation).toBe(70);
    // Points invested preserved
    expect(weapons.pointsInvested).toBe(10);
  });

  it('rejects allocations that exceed 100% total', () => {
    const state = makeResearchState({
      activeResearch: [
        { techId: 'basic_propulsion', pointsInvested: 0, allocation: 50 },
        { techId: 'basic_weapons', pointsInvested: 0, allocation: 50 },
      ],
    });

    expect(() =>
      setResearchAllocation(state, [
        { techId: 'basic_propulsion', allocation: 60 },
        { techId: 'basic_weapons', allocation: 60 },
      ]),
    ).toThrow();
  });

  it('allows total less than 100% (unused allocation)', () => {
    const state = makeResearchState({
      activeResearch: [
        { techId: 'basic_propulsion', pointsInvested: 0, allocation: 100 },
      ],
    });

    const next = setResearchAllocation(state, [
      { techId: 'basic_propulsion', allocation: 70 },
    ]);

    expect(next.activeResearch[0].allocation).toBe(70);
  });

  it('sets allocation to 0 for active techs not mentioned in the array', () => {
    const state = makeResearchState({
      activeResearch: [
        { techId: 'basic_propulsion', pointsInvested: 0, allocation: 100 },
        { techId: 'basic_weapons', pointsInvested: 0, allocation: 0 },
      ],
    });

    const next = setResearchAllocation(state, [
      { techId: 'basic_propulsion', allocation: 80 },
      // basic_weapons omitted
    ]);

    const weapons = next.activeResearch.find(r => r.techId === 'basic_weapons')!;
    expect(weapons.allocation).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// processResearchTick
// ---------------------------------------------------------------------------

describe('processResearchTick', () => {
  it('distributes research points proportionally to allocation', () => {
    const state = makeResearchState({
      activeResearch: [
        { techId: 'basic_propulsion', pointsInvested: 0, allocation: 60 },
        { techId: 'basic_weapons', pointsInvested: 0, allocation: 40 },
      ],
    });
    const species = makeSpecies(5); // research factor = 1.0

    const { newState } = processResearchTick(state, 100, species, MOCK_TECHS);

    const propulsion = newState.activeResearch.find(r => r.techId === 'basic_propulsion')!;
    const weapons = newState.activeResearch.find(r => r.techId === 'basic_weapons')!;
    // 100 points * 1.0 species * 60% allocation = 60
    expect(propulsion.pointsInvested).toBeCloseTo(60);
    // 100 points * 1.0 species * 40% allocation = 40
    expect(weapons.pointsInvested).toBeCloseTo(40);
  });

  it('applies species research trait bonus correctly', () => {
    const stateNormal = makeResearchState({
      activeResearch: [{ techId: 'basic_propulsion', pointsInvested: 0, allocation: 100 }],
    });
    const stateGenius = makeResearchState({
      activeResearch: [{ techId: 'basic_propulsion', pointsInvested: 0, allocation: 100 }],
    });
    const normalSpecies = makeSpecies(5);  // factor = 1.0
    const geniusSpecies = makeSpecies(10); // factor = 2.0

    const { newState: normalState } = processResearchTick(stateNormal, 100, normalSpecies, MOCK_TECHS);
    const { newState: geniusState } = processResearchTick(stateGenius, 100, geniusSpecies, MOCK_TECHS);

    const normalPoints = normalState.activeResearch[0]?.pointsInvested ?? 0;
    const geniusPoints = geniusState.activeResearch[0]?.pointsInvested ?? 0;
    // Genius species should invest exactly twice as many points
    expect(geniusPoints).toBeCloseTo(normalPoints * 2);
  });

  it('completes a tech when points invested reach the cost', () => {
    const state = makeResearchState({
      activeResearch: [
        // basic_weapons costs 80; invest 80 in one tick
        { techId: 'basic_weapons', pointsInvested: 0, allocation: 100 },
      ],
    });
    const species = makeSpecies(5); // factor = 1.0

    // 80 research points * 1.0 factor * 100% = 80 >= cost of 80
    const { newState, completed } = processResearchTick(state, 80, species, MOCK_TECHS);

    expect(completed).toHaveLength(1);
    expect(completed[0].id).toBe('basic_weapons');
    expect(newState.completedTechs).toContain('basic_weapons');
    expect(newState.activeResearch).toHaveLength(0);
  });

  it('does not complete a tech if points are insufficient', () => {
    const state = makeResearchState({
      activeResearch: [
        // basic_weapons costs 80; only invest 50
        { techId: 'basic_weapons', pointsInvested: 0, allocation: 100 },
      ],
    });
    const species = makeSpecies(5);

    const { newState, completed } = processResearchTick(state, 50, species, MOCK_TECHS);

    expect(completed).toHaveLength(0);
    expect(newState.completedTechs).not.toContain('basic_weapons');
    expect(newState.activeResearch).toHaveLength(1);
    expect(newState.activeResearch[0].pointsInvested).toBeCloseTo(50);
  });

  it('accumulates points across multiple ticks', () => {
    let state = makeResearchState({
      activeResearch: [
        // basic_weapons costs 80; invest 40 per tick -> 2 ticks
        { techId: 'basic_weapons', pointsInvested: 0, allocation: 100 },
      ],
    });
    const species = makeSpecies(5);

    // Tick 1: 40 points invested, not yet complete
    const result1 = processResearchTick(state, 40, species, MOCK_TECHS);
    expect(result1.completed).toHaveLength(0);
    expect(result1.newState.activeResearch[0].pointsInvested).toBeCloseTo(40);

    // Tick 2: another 40 -> total 80 >= cost
    state = result1.newState;
    const result2 = processResearchTick(state, 40, species, MOCK_TECHS);
    expect(result2.completed).toHaveLength(1);
    expect(result2.completed[0].id).toBe('basic_weapons');
    expect(result2.newState.completedTechs).toContain('basic_weapons');
  });

  it('accumulates totalResearchGenerated each tick', () => {
    const state = makeResearchState({
      totalResearchGenerated: 50,
      activeResearch: [{ techId: 'basic_propulsion', pointsInvested: 0, allocation: 100 }],
    });
    const species = makeSpecies(5); // factor = 1.0

    const { newState } = processResearchTick(state, 100, species, MOCK_TECHS);

    // effective = 100 * 1.0 = 100; total = 50 + 100 = 150
    expect(newState.totalResearchGenerated).toBeCloseTo(150);
  });

  it('advances the age when a tech with age_unlock effect completes', () => {
    const state = makeResearchState({
      completedTechs: ['basic_propulsion', 'basic_weapons'],
      activeResearch: [
        // fusion_theory costs 200 and unlocks fusion
        { techId: 'fusion_theory', pointsInvested: 190, allocation: 100 },
      ],
      currentAge: 'nano_atomic',
    });
    const species = makeSpecies(5);

    // 10 more points -> 190 + 10 = 200 >= cost of 200
    const { newState, completed } = processResearchTick(state, 10, species, MOCK_TECHS);

    expect(completed[0].id).toBe('fusion_theory');
    expect(newState.currentAge).toBe('fusion');
  });

  it('handles multiple simultaneous research projects', () => {
    const state = makeResearchState({
      activeResearch: [
        // basic_propulsion costs 100, basic_weapons costs 80
        { techId: 'basic_propulsion', pointsInvested: 0, allocation: 50 },
        { techId: 'basic_weapons', pointsInvested: 0, allocation: 50 },
      ],
    });
    const species = makeSpecies(5);

    // 200 points * 50% each = 100 points each
    // basic_propulsion: 100 >= 100 (completes)
    // basic_weapons: 100 >= 80 (also completes)
    const { newState, completed } = processResearchTick(state, 200, species, MOCK_TECHS);

    expect(completed).toHaveLength(2);
    expect(newState.completedTechs).toContain('basic_propulsion');
    expect(newState.completedTechs).toContain('basic_weapons');
    expect(newState.activeResearch).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// canAdvanceAge
// ---------------------------------------------------------------------------

describe('canAdvanceAge', () => {
  it('returns false when no tech exists that unlocks the target age', () => {
    const state = makeResearchState({ completedTechs: [] });
    // 'anti_matter' has no gate tech in our mock tree
    expect(canAdvanceAge(state, 'anti_matter', MOCK_TECHS)).toBe(false);
  });

  it('returns false when prerequisites for the age gate tech are not met', () => {
    const state = makeResearchState({
      completedTechs: ['basic_propulsion'], // missing basic_weapons
    });
    // fusion_theory (gate for fusion) requires both
    expect(canAdvanceAge(state, 'fusion', MOCK_TECHS)).toBe(false);
  });

  it('returns true when all prerequisites for the age gate tech are met', () => {
    const state = makeResearchState({
      completedTechs: ['basic_propulsion', 'basic_weapons'],
    });
    expect(canAdvanceAge(state, 'fusion', MOCK_TECHS)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getResearchSpeed
// ---------------------------------------------------------------------------

describe('getResearchSpeed', () => {
  it('returns estimated ticks to complete based on allocation and points per tick', () => {
    // cost=100, allocation=100%, researchPerTick=10, speciesBonus=1.0
    // effective per tick = 10 * 1.0 * 1.0 = 10 -> 10 ticks
    expect(getResearchSpeed(100, 100, 10, 1.0)).toBe(10);
  });

  it('doubles ticks when allocation is halved', () => {
    // allocation 50% -> 5 effective points per tick -> 20 ticks
    expect(getResearchSpeed(100, 50, 10, 1.0)).toBe(20);
  });

  it('halves ticks when species bonus is 2.0', () => {
    // speciesBonus 2.0 -> 20 effective points -> 5 ticks
    expect(getResearchSpeed(100, 100, 10, 2.0)).toBe(5);
  });

  it('returns Infinity when effective points per tick is zero', () => {
    expect(getResearchSpeed(100, 0, 10, 1.0)).toBe(Infinity);
    expect(getResearchSpeed(100, 100, 0, 1.0)).toBe(Infinity);
  });

  it('rounds up partial ticks (ceiling)', () => {
    // 100 / 30 = 3.33... -> 4 ticks
    expect(getResearchSpeed(100, 100, 30, 1.0)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// applyTechEffects
// ---------------------------------------------------------------------------

describe('applyTechEffects', () => {
  it('advances currentAge when tech has age_unlock effect', () => {
    const empire = makeEmpire({ currentAge: 'nano_atomic' });
    const fusionTheory = MOCK_TECHS.find(t => t.id === 'fusion_theory')!;

    const updated = applyTechEffects(empire, fusionTheory);

    expect(updated.currentAge).toBe('fusion');
  });

  it('does not downgrade currentAge if already at a later age', () => {
    const empire = makeEmpire({ currentAge: 'nano_fusion' });
    const fusionTheory = MOCK_TECHS.find(t => t.id === 'fusion_theory')!;

    const updated = applyTechEffects(empire, fusionTheory);

    // fusion is earlier than nano_fusion — no change
    expect(updated.currentAge).toBe('nano_fusion');
  });

  it('applies research stat_bonus to empire researchPoints', () => {
    const empire = makeEmpire({ researchPoints: 10 });
    const tech: Technology = {
      id: 'test_boost',
      name: 'Research Boost',
      description: 'Increases research output',
      category: 'racial',
      age: 'nano_atomic',
      cost: 50,
      prerequisites: [],
      effects: [{ type: 'stat_bonus', stat: 'research', value: 5 }],
    };

    const updated = applyTechEffects(empire, tech);

    expect(updated.researchPoints).toBe(15);
  });

  it('does not mutate the original empire', () => {
    const empire = makeEmpire({ currentAge: 'nano_atomic' });
    const originalAge = empire.currentAge;
    const fusionTheory = MOCK_TECHS.find(t => t.id === 'fusion_theory')!;

    applyTechEffects(empire, fusionTheory);

    expect(empire.currentAge).toBe(originalAge);
  });

  it('returns unchanged empire when tech has no effects', () => {
    const empire = makeEmpire();
    const noEffectTech: Technology = {
      id: 'placeholder',
      name: 'Placeholder',
      description: 'No effects',
      category: 'racial',
      age: 'nano_atomic',
      cost: 10,
      prerequisites: [],
      effects: [],
    };

    const updated = applyTechEffects(empire, noEffectTech);

    expect(updated.currentAge).toBe(empire.currentAge);
    expect(updated.researchPoints).toBe(empire.researchPoints);
  });

  it('applies multiple effects from a single tech', () => {
    const empire = makeEmpire({ currentAge: 'fusion', researchPoints: 0 });
    const tech: Technology = {
      id: 'multi_effect',
      name: 'Multi Effect',
      description: 'Has several effects',
      category: 'racial',
      age: 'fusion',
      cost: 250,
      prerequisites: [],
      effects: [
        { type: 'stat_bonus', stat: 'research', value: 10 },
        { type: 'age_unlock', age: 'nano_fusion' },
      ],
    };

    const updated = applyTechEffects(empire, tech);

    expect(updated.researchPoints).toBe(10);
    expect(updated.currentAge).toBe('nano_fusion');
  });
});

// ---------------------------------------------------------------------------
// Species filtering (speciesId on Technology)
// ---------------------------------------------------------------------------

describe('getAvailableTechs — species filtering', () => {
  const SPECIES_TECHS: Technology[] = [
    {
      id: 'universal_tech',
      name: 'Universal Tech',
      description: 'Available to all species',
      category: 'weapons',
      age: 'nano_atomic',
      cost: 100,
      prerequisites: [],
      effects: [{ type: 'stat_bonus', stat: 'combat', value: 1 }],
    },
    {
      id: 'vaelori_psionic',
      name: 'Vaelori Psionics',
      description: 'Only available to Vaelori species',
      category: 'racial',
      age: 'nano_atomic',
      cost: 100,
      prerequisites: [],
      effects: [{ type: 'enable_ability', ability: 'psionics' }],
      speciesId: 'vaelori',
    },
    {
      id: 'khazari_forge',
      name: 'Khazari Forge Mastery',
      description: 'Only available to Khazari species',
      category: 'racial',
      age: 'nano_atomic',
      cost: 100,
      prerequisites: [],
      effects: [{ type: 'stat_bonus', stat: 'construction', value: 5 }],
      speciesId: 'khazari',
    },
  ];

  it('returns all techs when no speciesId is provided', () => {
    const state = makeResearchState();
    const available = getAvailableTechs(SPECIES_TECHS, state);
    const ids = available.map(t => t.id);

    expect(ids).toContain('universal_tech');
    expect(ids).toContain('vaelori_psionic');
    expect(ids).toContain('khazari_forge');
  });

  it('includes universal techs and matching species techs', () => {
    const state = makeResearchState();
    const available = getAvailableTechs(SPECIES_TECHS, state, 'vaelori');
    const ids = available.map(t => t.id);

    expect(ids).toContain('universal_tech');
    expect(ids).toContain('vaelori_psionic');
    expect(ids).not.toContain('khazari_forge');
  });

  it('excludes techs belonging to a different species', () => {
    const state = makeResearchState();
    const available = getAvailableTechs(SPECIES_TECHS, state, 'khazari');
    const ids = available.map(t => t.id);

    expect(ids).toContain('universal_tech');
    expect(ids).toContain('khazari_forge');
    expect(ids).not.toContain('vaelori_psionic');
  });

  it('includes techs without speciesId for any species', () => {
    const state = makeResearchState();
    const available = getAvailableTechs(SPECIES_TECHS, state, 'teranos');
    const ids = available.map(t => t.id);

    expect(ids).toContain('universal_tech');
    expect(ids).not.toContain('vaelori_psionic');
    expect(ids).not.toContain('khazari_forge');
  });

  it('startResearch respects species filtering', () => {
    const state = makeResearchState();

    // Vaelori can start their own psionic tech
    const nextState = startResearch(state, 'vaelori_psionic', SPECIES_TECHS, 50, 'vaelori');
    expect(nextState.activeResearch).toHaveLength(1);
    expect(nextState.activeResearch[0].techId).toBe('vaelori_psionic');

    // Khazari cannot start Vaelori psionic tech
    expect(() =>
      startResearch(state, 'vaelori_psionic', SPECIES_TECHS, 50, 'khazari'),
    ).toThrow();
  });
});
