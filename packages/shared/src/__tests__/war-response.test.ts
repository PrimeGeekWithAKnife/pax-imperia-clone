import { describe, it, expect } from 'vitest';
import {
  createEmpireWarState,
  tickWarState,
  recordBattle,
  recordCasualties,
  calculateWarHappinessImpact,
  isWarWearinessCrisis,
  type EmpireWarState,
} from '../engine/war-response.js';
import { calculatePlanetHappiness } from '../engine/happiness.js';
import type { Species } from '../types/species.js';
import type { Planet, Building } from '../types/galaxy.js';
import type { EmpireResources } from '../types/resources.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeSpecies(id: string, overrides: Partial<Species> = {}): Species {
  return {
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    description: '',
    portrait: `portrait_${id}`,
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
      temperatureTolerance: 35,
      idealGravity: 1.0,
      gravityTolerance: 0.3,
      preferredAtmospheres: ['oxygen_nitrogen'],
    },
    specialAbilities: [],
    isPrebuilt: true,
    defaultGovernment: 'democracy',
    allowedGovernments: ['democracy'],
    ...overrides,
  };
}

const khazari = makeSpecies('khazari', {
  traits: { construction: 9, reproduction: 5, research: 3, espionage: 2, economy: 6, combat: 9, diplomacy: 2 },
  specialAbilities: ['silicon_based'],
});

const vaelori = makeSpecies('vaelori', {
  traits: { construction: 2, reproduction: 3, research: 9, espionage: 8, economy: 5, combat: 3, diplomacy: 6 },
  specialAbilities: ['psychic'],
});

const nexari = makeSpecies('nexari', {
  traits: { construction: 8, reproduction: 2, research: 9, espionage: 4, economy: 5, combat: 6, diplomacy: 3 },
  specialAbilities: ['cybernetic', 'hive_mind'],
});

const zorvathi = makeSpecies('zorvathi', {
  traits: { construction: 9, reproduction: 8, research: 3, espionage: 4, economy: 5, combat: 6, diplomacy: 2 },
  specialAbilities: ['subterranean', 'hive_mind'],
});

const orivani = makeSpecies('orivani', {
  traits: { construction: 7, reproduction: 7, research: 3, espionage: 2, economy: 5, combat: 8, diplomacy: 5 },
  specialAbilities: ['devout'],
});

const sylvani = makeSpecies('sylvani', {
  traits: { construction: 3, reproduction: 8, research: 8, espionage: 2, economy: 6, combat: 2, diplomacy: 7 },
  specialAbilities: ['photosynthetic'],
});

const vethara = makeSpecies('vethara', {
  traits: { construction: 3, reproduction: 7, research: 5, espionage: 8, economy: 4, combat: 4, diplomacy: 8 },
  specialAbilities: ['symbiotic'],
});

const pyrenth = makeSpecies('pyrenth', {
  traits: { construction: 10, reproduction: 2, research: 4, espionage: 3, economy: 6, combat: 8, diplomacy: 3 },
  specialAbilities: ['silicon_based', 'subterranean'],
});

const aethyn = makeSpecies('aethyn', {
  traits: { construction: 2, reproduction: 3, research: 10, espionage: 8, economy: 3, combat: 5, diplomacy: 5 },
  specialAbilities: ['dimensional'],
});

const luminari = makeSpecies('luminari', {
  traits: { construction: 2, reproduction: 4, research: 9, espionage: 9, economy: 5, combat: 3, diplomacy: 6 },
  specialAbilities: ['energy_form'],
});

const kaelenth = makeSpecies('kaelenth', {
  traits: { construction: 10, reproduction: 1, research: 9, espionage: 4, economy: 6, combat: 5, diplomacy: 2 },
  specialAbilities: ['synthetic'],
});

function makePlanet(overrides: Partial<Planet> = {}): Planet {
  return {
    id: 'planet-1',
    name: 'Terra',
    orbitalIndex: 3,
    type: 'terran',
    atmosphere: 'oxygen_nitrogen',
    gravity: 1.0,
    temperature: 295,
    naturalResources: 50,
    maxPopulation: 1_000_000,
    currentPopulation: 200_000,
    ownerId: 'empire-1',
    buildings: [],
    productionQueue: [],
    ...overrides,
  };
}

function makeResources(overrides: Partial<EmpireResources> = {}): EmpireResources {
  return {
    credits: 500,
    minerals: 100,
    rareElements: 0,
    energy: 50,
    organics: 100,
    exoticMaterials: 0,
    faith: 0,
    researchPoints: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// createEmpireWarState
// ---------------------------------------------------------------------------

describe('createEmpireWarState', () => {
  it('creates a fresh war state with zero values', () => {
    const state = createEmpireWarState();
    expect(state.warWeariness).toBe(0);
    expect(state.peaceTicks).toBe(0);
    expect(state.recentBattles).toEqual([]);
    expect(state.recentCasualties).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// tickWarState — weariness accumulation and decay
// ---------------------------------------------------------------------------

describe('tickWarState — weariness', () => {
  it('accumulates weariness during war for the Vaelori (high rate)', () => {
    let state = createEmpireWarState();
    state = tickWarState(state, true, vaelori, 1);
    expect(state.warWeariness).toBeGreaterThan(0);
    expect(state.warWeariness).toBeCloseTo(0.5, 2);
    expect(state.peaceTicks).toBe(0);
  });

  it('accumulates weariness slowly for hive minds (Nexari)', () => {
    let state = createEmpireWarState();
    state = tickWarState(state, true, nexari, 1);
    expect(state.warWeariness).toBeCloseTo(0.05, 3);
  });

  it('accumulates weariness slowly for the Khazari (combat 9)', () => {
    let state = createEmpireWarState();
    state = tickWarState(state, true, khazari, 1);
    expect(state.warWeariness).toBeCloseTo(0.1, 2);
  });

  it('decays weariness during peace', () => {
    let state = createEmpireWarState();
    state = { ...state, warWeariness: 20 };
    state = tickWarState(state, false, vaelori, 1);
    expect(state.warWeariness).toBe(19);
    expect(state.peaceTicks).toBe(1);
  });

  it('weariness cannot exceed 100', () => {
    let state = createEmpireWarState();
    state = { ...state, warWeariness: 99.9 };
    state = tickWarState(state, true, vaelori, 1);
    expect(state.warWeariness).toBe(100);
  });

  it('weariness cannot go below 0', () => {
    let state = createEmpireWarState();
    state = { ...state, warWeariness: 0.5 };
    state = tickWarState(state, false, vaelori, 1);
    expect(state.warWeariness).toBe(0);
  });

  it('increments peace ticks during peace', () => {
    let state = createEmpireWarState();
    state = tickWarState(state, false, khazari, 1);
    expect(state.peaceTicks).toBe(1);
    state = tickWarState(state, false, khazari, 2);
    expect(state.peaceTicks).toBe(2);
  });

  it('resets peace ticks when war begins', () => {
    let state = createEmpireWarState();
    state = { ...state, peaceTicks: 100 };
    state = tickWarState(state, true, khazari, 1);
    expect(state.peaceTicks).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// recordBattle / recordCasualties
// ---------------------------------------------------------------------------

describe('recordBattle / recordCasualties', () => {
  it('appends a battle record', () => {
    let state = createEmpireWarState();
    state = recordBattle(state, 10, true, false, false);
    expect(state.recentBattles).toHaveLength(1);
    expect(state.recentBattles[0]).toEqual({
      tick: 10, won: true, planetCaptured: false, planetLost: false,
    });
  });

  it('appends a casualty record', () => {
    let state = createEmpireWarState();
    state = recordCasualties(state, 10, 5);
    expect(state.recentCasualties).toHaveLength(1);
    expect(state.recentCasualties[0]).toEqual({ tick: 10, shipsLost: 5 });
  });

  it('does not append a casualty record for zero losses', () => {
    let state = createEmpireWarState();
    state = recordCasualties(state, 10, 0);
    expect(state.recentCasualties).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// calculateWarHappinessImpact — species-specific responses
// ---------------------------------------------------------------------------

describe('calculateWarHappinessImpact — Khazari (war-lovers)', () => {
  it('provides a positive happiness boost during war', () => {
    const state = createEmpireWarState();
    const impact = calculateWarHappinessImpact(khazari, true, state, 'autocracy', 100);
    expect(impact.total).toBeGreaterThan(0);
    const warFactor = impact.factors.find(f => f.label === 'Glorious conflict');
    expect(warFactor).toBeDefined();
    expect(warFactor!.points).toBe(5);
  });

  it('suffers peace restlessness after prolonged peace', () => {
    const state: EmpireWarState = {
      ...createEmpireWarState(),
      peaceTicks: 150, // well beyond the 50-tick threshold
    };
    const impact = calculateWarHappinessImpact(khazari, false, state, 'autocracy', 200);
    const restless = impact.factors.find(f => f.label === 'Restless during peace');
    expect(restless).toBeDefined();
    expect(restless!.points).toBeLessThan(0);
  });

  it('does not suffer peace restlessness during short peace', () => {
    const state: EmpireWarState = {
      ...createEmpireWarState(),
      peaceTicks: 20,
    };
    const impact = calculateWarHappinessImpact(khazari, false, state, 'autocracy', 20);
    const restless = impact.factors.find(f => f.label === 'Restless during peace');
    expect(restless).toBeUndefined();
  });
});

describe('calculateWarHappinessImpact — Vaelori (psychic distress)', () => {
  it('applies a severe happiness penalty during war', () => {
    const state = createEmpireWarState();
    const impact = calculateWarHappinessImpact(vaelori, true, state, 'technocracy', 100);
    expect(impact.total).toBeLessThan(0);
    const warFactor = impact.factors.find(f => f.label === 'Psychic anguish of war');
    expect(warFactor).toBeDefined();
    expect(warFactor!.points).toBe(-20);
  });

  it('is heavily affected by casualties', () => {
    const state = recordCasualties(createEmpireWarState(), 95, 3);
    const impact = calculateWarHappinessImpact(vaelori, true, state, 'technocracy', 100);
    const casualty = impact.factors.find(f => f.label === 'Casualties suffered');
    expect(casualty).toBeDefined();
    expect(casualty!.points).toBeLessThan(-5);
  });
});

describe('calculateWarHappinessImpact — Nexari (hive mind, no opinion)', () => {
  it('applies no base war happiness modifier', () => {
    const state = createEmpireWarState();
    const impact = calculateWarHappinessImpact(nexari, true, state, 'hive_mind', 100);
    // The base factor should not appear (0 points)
    const warFactor = impact.factors.find(f => f.label === 'Collective processing');
    expect(warFactor).toBeUndefined(); // 0 points = not added
  });
});

describe('calculateWarHappinessImpact — Zorvathi (swarm instinct)', () => {
  it('gains a modest happiness boost from war', () => {
    const state = createEmpireWarState();
    const impact = calculateWarHappinessImpact(zorvathi, true, state, 'hive_mind', 100);
    const warFactor = impact.factors.find(f => f.label === 'Swarm expansion instinct');
    expect(warFactor).toBeDefined();
    expect(warFactor!.points).toBe(3);
  });
});

describe('calculateWarHappinessImpact — Orivani (government-dependent)', () => {
  it('under theocracy, war is a holy crusade (+8)', () => {
    const state = createEmpireWarState();
    const impact = calculateWarHappinessImpact(orivani, true, state, 'theocracy', 100);
    const warFactor = impact.factors.find(f => f.label === 'Holy crusade');
    expect(warFactor).toBeDefined();
    expect(warFactor!.points).toBe(8);
  });

  it('under non-theocracy, war is sacrilege (-15)', () => {
    const state = createEmpireWarState();
    const impact = calculateWarHappinessImpact(orivani, true, state, 'autocracy', 100);
    const warFactor = impact.factors.find(f => f.label === 'Unjust war (no divine mandate)');
    expect(warFactor).toBeDefined();
    expect(warFactor!.points).toBe(-15);
  });
});

describe('calculateWarHappinessImpact — Sylvani (deeply affected)', () => {
  it('applies -15 during war', () => {
    const state = createEmpireWarState();
    const impact = calculateWarHappinessImpact(sylvani, true, state, 'equality', 100);
    expect(impact.total).toBe(-15);
  });
});

describe('calculateWarHappinessImpact — Vethara (hosts in danger)', () => {
  it('applies -18 during war', () => {
    const state = createEmpireWarState();
    const impact = calculateWarHappinessImpact(vethara, true, state, 'federation', 100);
    const warFactor = impact.factors.find(f => f.label === 'Hosts in danger');
    expect(warFactor).toBeDefined();
    expect(warFactor!.points).toBe(-18);
  });
});

describe('calculateWarHappinessImpact — Pyrenth (forge of conflict)', () => {
  it('gains a small happiness boost from war', () => {
    const state = createEmpireWarState();
    const impact = calculateWarHappinessImpact(pyrenth, true, state, 'empire', 100);
    const warFactor = impact.factors.find(f => f.label === 'The forge of conflict');
    expect(warFactor).toBeDefined();
    expect(warFactor!.points).toBe(2);
  });
});

describe('calculateWarHappinessImpact — Aethyn (barely affected)', () => {
  it('applies minimal penalty during war', () => {
    const state = createEmpireWarState();
    const impact = calculateWarHappinessImpact(aethyn, true, state, 'technocracy', 100);
    expect(impact.total).toBe(-1);
  });
});

describe('calculateWarHappinessImpact — Luminari (detached observer)', () => {
  it('applies -3 during war', () => {
    const state = createEmpireWarState();
    const impact = calculateWarHappinessImpact(luminari, true, state, 'technocracy', 100);
    expect(impact.total).toBe(-3);
  });
});

describe('calculateWarHappinessImpact — Kaelenth (synthetic, calculated)', () => {
  it('applies -2 during war', () => {
    const state = createEmpireWarState();
    const impact = calculateWarHappinessImpact(kaelenth, true, state, 'technocracy', 100);
    expect(impact.total).toBe(-2);
  });
});

// ---------------------------------------------------------------------------
// War weariness happiness impact
// ---------------------------------------------------------------------------

describe('calculateWarHappinessImpact — war weariness', () => {
  it('adds a penalty proportional to weariness level', () => {
    const state: EmpireWarState = {
      ...createEmpireWarState(),
      warWeariness: 50,
    };
    const impact = calculateWarHappinessImpact(vaelori, true, state, 'technocracy', 100);
    const weariness = impact.factors.find(f => f.label.includes('War weariness'));
    expect(weariness).toBeDefined();
    expect(weariness!.points).toBe(-10); // 50 / 5 = 10
  });

  it('at maximum weariness (100), penalty is -20', () => {
    const state: EmpireWarState = {
      ...createEmpireWarState(),
      warWeariness: 100,
    };
    const impact = calculateWarHappinessImpact(vaelori, true, state, 'technocracy', 100);
    const weariness = impact.factors.find(f => f.label.includes('War weariness'));
    expect(weariness).toBeDefined();
    expect(weariness!.points).toBe(-20);
  });

  it('at zero weariness, no weariness factor appears', () => {
    const state = createEmpireWarState();
    const impact = calculateWarHappinessImpact(vaelori, true, state, 'technocracy', 100);
    const weariness = impact.factors.find(f => f.label.includes('War weariness'));
    expect(weariness).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Victory / defeat momentum
// ---------------------------------------------------------------------------

describe('calculateWarHappinessImpact — victory momentum', () => {
  it('recent victory provides happiness boost', () => {
    const state = recordBattle(createEmpireWarState(), 95, true, false, false);
    const impact = calculateWarHappinessImpact(khazari, true, state, 'autocracy', 100);
    const victories = impact.factors.find(f => f.label === 'Victories in battle');
    expect(victories).toBeDefined();
    expect(victories!.points).toBeGreaterThan(0);
  });

  it('recent defeat provides happiness penalty', () => {
    const state = recordBattle(createEmpireWarState(), 95, false, false, false);
    const impact = calculateWarHappinessImpact(khazari, true, state, 'autocracy', 100);
    const defeats = impact.factors.find(f => f.label === 'Defeats in battle');
    expect(defeats).toBeDefined();
    expect(defeats!.points).toBeLessThan(0);
  });

  it('planet capture provides territorial pride', () => {
    const state = recordBattle(createEmpireWarState(), 95, true, true, false);
    const impact = calculateWarHappinessImpact(khazari, true, state, 'autocracy', 100);
    const conquest = impact.factors.find(f => f.label === 'Territorial conquest');
    expect(conquest).toBeDefined();
    expect(conquest!.points).toBeGreaterThan(0);
  });

  it('planet loss provides territory lost penalty', () => {
    const state = recordBattle(createEmpireWarState(), 95, false, false, true);
    const impact = calculateWarHappinessImpact(khazari, true, state, 'autocracy', 100);
    const loss = impact.factors.find(f => f.label === 'Territory lost');
    expect(loss).toBeDefined();
    expect(loss!.points).toBeLessThan(0);
  });

  it('victory momentum decays over time', () => {
    const state = recordBattle(createEmpireWarState(), 80, true, false, false);

    // Close to the battle — strong momentum.
    const impactEarly = calculateWarHappinessImpact(khazari, true, state, 'autocracy', 82);
    const earlyBoost = impactEarly.factors.find(f => f.label === 'Victories in battle');

    // Late — decayed momentum.
    const impactLate = calculateWarHappinessImpact(khazari, true, state, 'autocracy', 99);
    const lateBoost = impactLate.factors.find(f => f.label === 'Victories in battle');

    // Early boost should be at least as large as late boost.
    const earlyPts = earlyBoost?.points ?? 0;
    const latePts = lateBoost?.points ?? 0;
    expect(earlyPts).toBeGreaterThanOrEqual(latePts);
  });
});

// ---------------------------------------------------------------------------
// Casualty sensitivity
// ---------------------------------------------------------------------------

describe('calculateWarHappinessImpact — casualty sensitivity', () => {
  it('Vaelori are deeply affected by casualties (sensitivity -5/ship)', () => {
    const state = recordCasualties(createEmpireWarState(), 98, 4);
    const impact = calculateWarHappinessImpact(vaelori, true, state, 'technocracy', 100);
    const casualties = impact.factors.find(f => f.label === 'Casualties suffered');
    expect(casualties).toBeDefined();
    // 4 ships * -5 * decay ~ close to -20
    expect(casualties!.points).toBeLessThan(-15);
  });

  it('Khazari shrug off casualties (sensitivity -1/ship)', () => {
    const state = recordCasualties(createEmpireWarState(), 98, 4);
    const impact = calculateWarHappinessImpact(khazari, true, state, 'autocracy', 100);
    const casualties = impact.factors.find(f => f.label === 'Casualties suffered');
    // 4 ships * -1 * decay ~ -4
    if (casualties) {
      expect(casualties.points).toBeGreaterThan(-8);
    }
  });

  it('Kaelenth (synthetic) barely notice casualties (-0.5/ship)', () => {
    const state = recordCasualties(createEmpireWarState(), 98, 4);
    const impact = calculateWarHappinessImpact(kaelenth, true, state, 'technocracy', 100);
    const casualties = impact.factors.find(f => f.label === 'Casualties suffered');
    // 4 ships * -0.5 * decay ~ -2, but rounds to -2
    if (casualties) {
      expect(casualties.points).toBeGreaterThan(-4);
    }
  });
});

// ---------------------------------------------------------------------------
// isWarWearinessCrisis
// ---------------------------------------------------------------------------

describe('isWarWearinessCrisis', () => {
  it('returns true when weariness exceeds 80', () => {
    const state: EmpireWarState = { ...createEmpireWarState(), warWeariness: 81 };
    expect(isWarWearinessCrisis(state)).toBe(true);
  });

  it('returns false when weariness is at or below 80', () => {
    const state: EmpireWarState = { ...createEmpireWarState(), warWeariness: 80 };
    expect(isWarWearinessCrisis(state)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integration: calculatePlanetHappiness with species-specific war response
// ---------------------------------------------------------------------------

describe('calculatePlanetHappiness — species-specific war response', () => {
  it('Khazari at war: score is HIGHER than the legacy flat-penalty score', () => {
    const planet = makePlanet();
    const resources = makeResources();
    const warState = createEmpireWarState();

    // Legacy: flat -10
    const legacy = calculatePlanetHappiness(planet, resources, true);

    // Species-specific: Khazari get +5 instead of -10
    const specific = calculatePlanetHappiness(
      planet, resources, true,
      khazari, warState, 'autocracy', 100,
    );

    expect(specific.score).toBeGreaterThan(legacy.score);
  });

  it('Vaelori at war: score is LOWER than the legacy flat-penalty score', () => {
    const planet = makePlanet();
    const resources = makeResources();
    const warState = createEmpireWarState();

    const legacy = calculatePlanetHappiness(planet, resources, true);

    const specific = calculatePlanetHappiness(
      planet, resources, true,
      vaelori, warState, 'technocracy', 100,
    );

    expect(specific.score).toBeLessThan(legacy.score);
  });

  it('Nexari at war with hive_mind: war has no happiness effect', () => {
    const planet = makePlanet();
    const resources = makeResources();
    const warState = createEmpireWarState();

    const atPeace = calculatePlanetHappiness(
      planet, resources, false,
      nexari, warState, 'hive_mind', 100,
    );

    const atWar = calculatePlanetHappiness(
      planet, resources, true,
      nexari, warState, 'hive_mind', 100,
    );

    expect(atWar.score).toBe(atPeace.score);
  });

  it('backwards compatibility: calling without species uses legacy -10', () => {
    const planet = makePlanet();
    const resources = makeResources();

    const report = calculatePlanetHappiness(planet, resources, true);

    const warFactor = report.factors.find(f => f.label === 'At war');
    expect(warFactor).toBeDefined();
    expect(warFactor!.points).toBe(-10);
  });

  it('at peace with no species, no war factor appears', () => {
    const planet = makePlanet();
    const resources = makeResources();

    const report = calculatePlanetHappiness(planet, resources, false);

    const warFactor = report.factors.find(f => f.label === 'At war');
    expect(warFactor).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Derived profiles for custom/unknown species
// ---------------------------------------------------------------------------

describe('derived profiles for unknown species', () => {
  it('high-combat custom species tolerates war better than low-combat', () => {
    const highCombat = makeSpecies('custom_warrior', {
      traits: { construction: 5, reproduction: 5, research: 5, espionage: 5, economy: 5, combat: 9, diplomacy: 5 },
    });
    const lowCombat = makeSpecies('custom_pacifist', {
      traits: { construction: 5, reproduction: 5, research: 5, espionage: 5, economy: 5, combat: 2, diplomacy: 5 },
    });
    const state = createEmpireWarState();

    const highImpact = calculateWarHappinessImpact(highCombat, true, state, 'democracy', 100);
    const lowImpact = calculateWarHappinessImpact(lowCombat, true, state, 'democracy', 100);

    expect(highImpact.total).toBeGreaterThan(lowImpact.total);
  });

  it('hive_mind custom species has zero base war happiness', () => {
    const hiveMind = makeSpecies('custom_hive', {
      specialAbilities: ['hive_mind'],
    });
    const state = createEmpireWarState();
    const impact = calculateWarHappinessImpact(hiveMind, true, state, 'hive_mind', 100);
    // No base war factor should appear
    const baseFactor = impact.factors.find(
      f => !f.label.includes('weariness') &&
           !f.label.includes('battle') &&
           !f.label.includes('Casualties') &&
           !f.label.includes('Territory') &&
           !f.label.includes('peace'),
    );
    expect(baseFactor).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Extended simulation: weariness accumulation over many ticks
// ---------------------------------------------------------------------------

describe('extended simulation — 200 ticks of war', () => {
  it('Vaelori reach war weariness crisis before Khazari', () => {
    let vaeloriState = createEmpireWarState();
    let khazariState = createEmpireWarState();

    let vaeloriCrisisTick = -1;
    let khazariCrisisTick = -1;

    // Run long enough for both species to potentially reach crisis.
    // Khazari at 0.1/tick need 801+ ticks; Vaelori at 0.5/tick need 161 ticks.
    for (let tick = 1; tick <= 1000; tick++) {
      vaeloriState = tickWarState(vaeloriState, true, vaelori, tick);
      khazariState = tickWarState(khazariState, true, khazari, tick);

      if (vaeloriCrisisTick < 0 && isWarWearinessCrisis(vaeloriState)) {
        vaeloriCrisisTick = tick;
      }
      if (khazariCrisisTick < 0 && isWarWearinessCrisis(khazariState)) {
        khazariCrisisTick = tick;
      }
    }

    expect(vaeloriCrisisTick).toBeGreaterThan(0);
    expect(khazariCrisisTick).toBeGreaterThan(0);
    expect(vaeloriCrisisTick).toBeLessThan(khazariCrisisTick);
  });

  it('Nexari (hive mind) never reach crisis in 200 ticks', () => {
    let state = createEmpireWarState();
    for (let tick = 1; tick <= 200; tick++) {
      state = tickWarState(state, true, nexari, tick);
    }
    // 200 * 0.05 = 10 weariness — well below 80
    expect(isWarWearinessCrisis(state)).toBe(false);
    expect(state.warWeariness).toBeCloseTo(10, 0);
  });
});
