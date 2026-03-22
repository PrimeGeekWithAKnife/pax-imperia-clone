/**
 * Tests for the demographics and governor personality engines.
 *
 * Covers:
 *  - Initial demographics creation with correct distributions
 *  - Age progression through ticks
 *  - Vocation distribution respects education level
 *  - Effective worker calculation for different building types
 *  - Governor personality generation
 *  - Governor modifier calculation
 *  - Governor loyalty evolution
 */

import { describe, it, expect } from 'vitest';
import {
  createInitialDemographics,
  tickDemographics,
  calculateEffectiveWorkers,
} from '../engine/demographics.js';
import type { DemographicModifiers } from '../engine/demographics.js';
import {
  generateGovernorPersonality,
  calculateGovernorModifiers,
  tickGovernorLoyalty,
} from '../engine/governor-personality.js';
import type { PlanetDemographics } from '../types/demographics.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDefaultModifiers(overrides: Partial<DemographicModifiers> = {}): DemographicModifiers {
  return {
    growthRate: 1.0,
    healthLevel: 70,
    educationLevel: 50,
    happiness: 30,
    isTheocracy: false,
    availableBuildings: [],
    ...overrides,
  };
}

function sumAge(d: PlanetDemographics): number {
  return d.age.young + d.age.workingAge + d.age.elderly;
}

function sumVocations(d: PlanetDemographics): number {
  const v = d.vocations;
  return v.scientists + v.workers + v.military + v.merchants
    + v.administrators + v.educators + v.medical + v.general;
}

function sumLoyalty(d: PlanetDemographics): number {
  const l = d.loyalty;
  return l.loyal + l.content + l.disgruntled + l.rebellious;
}

function sumFaith(d: PlanetDemographics): number {
  const f = d.faith;
  return f.fanatics + f.observant + f.casual + f.indifferent + f.secular;
}

// ---------------------------------------------------------------------------
// createInitialDemographics
// ---------------------------------------------------------------------------

describe('createInitialDemographics', () => {
  it('creates demographics with the correct total population', () => {
    const d = createInitialDemographics(10000, 'teranos');
    expect(d.totalPopulation).toBe(10000);
  });

  it('age groups sum to total population', () => {
    const d = createInitialDemographics(10000, 'teranos');
    expect(sumAge(d)).toBe(10000);
  });

  it('allocates ~20% young, ~65% working, ~15% elderly', () => {
    const d = createInitialDemographics(10000, 'teranos');
    expect(d.age.young).toBe(2000);
    expect(d.age.workingAge).toBe(6500);
    expect(d.age.elderly).toBe(1500);
  });

  it('vocation distribution sums to working age population', () => {
    const d = createInitialDemographics(10000, 'teranos');
    expect(sumVocations(d)).toBe(d.age.workingAge);
  });

  it('starts with mostly general labour', () => {
    const d = createInitialDemographics(10000, 'teranos');
    const specialistTotal = d.vocations.scientists + d.vocations.workers + d.vocations.military
      + d.vocations.merchants + d.vocations.administrators + d.vocations.educators + d.vocations.medical;
    expect(d.vocations.general).toBeGreaterThan(specialistTotal);
  });

  it('loyalty distribution sums to total population', () => {
    const d = createInitialDemographics(10000, 'teranos');
    expect(sumLoyalty(d)).toBe(10000);
  });

  it('starts with majority content/loyal', () => {
    const d = createInitialDemographics(10000, 'teranos');
    expect(d.loyalty.loyal + d.loyalty.content).toBeGreaterThan(
      d.loyalty.disgruntled + d.loyalty.rebellious,
    );
  });

  it('faith distribution sums to total population', () => {
    const d = createInitialDemographics(10000, 'teranos');
    expect(sumFaith(d)).toBe(10000);
  });

  it('Orivani have a heavily devout faith distribution', () => {
    const d = createInitialDemographics(10000, 'orivani');
    expect(d.faith.fanatics).toBeGreaterThan(d.faith.secular);
    expect(d.faith.fanatics + d.faith.observant).toBeGreaterThan(5000);
  });

  it('Kaelenth have a heavily secular faith distribution', () => {
    const d = createInitialDemographics(10000, 'kaelenth');
    expect(d.faith.secular).toBeGreaterThan(d.faith.fanatics);
    expect(d.faith.secular + d.faith.indifferent).toBeGreaterThan(5000);
  });

  it('sets the primary species ID', () => {
    const d = createInitialDemographics(5000, 'sylvani');
    expect(d.primarySpeciesId).toBe('sylvani');
  });

  it('handles zero population gracefully', () => {
    const d = createInitialDemographics(0, 'teranos');
    expect(d.totalPopulation).toBe(0);
    expect(sumAge(d)).toBe(0);
  });

  it('handles very small populations', () => {
    const d = createInitialDemographics(10, 'teranos');
    expect(d.totalPopulation).toBe(10);
    expect(sumAge(d)).toBe(10);
  });

  it('sets default education and health levels', () => {
    const d = createInitialDemographics(1000, 'teranos');
    expect(d.educationLevel).toBe(50);
    expect(d.healthLevel).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// tickDemographics — age progression
// ---------------------------------------------------------------------------

describe('tickDemographics — age progression', () => {
  it('does not mutate the original demographics', () => {
    const original = createInitialDemographics(10000, 'teranos');
    const originalPop = original.totalPopulation;
    tickDemographics(original, makeDefaultModifiers());
    expect(original.totalPopulation).toBe(originalPop);
  });

  it('population grows with positive conditions', () => {
    const d = createInitialDemographics(10000, 'teranos');
    const modifiers = makeDefaultModifiers({ growthRate: 1.5, healthLevel: 80, happiness: 50 });
    const result = tickDemographics(d, modifiers);
    expect(result.totalPopulation).toBeGreaterThan(d.totalPopulation);
  });

  it('population declines with very poor health', () => {
    const d = createInitialDemographics(10000, 'teranos');
    const modifiers = makeDefaultModifiers({ growthRate: 0.1, healthLevel: 5, happiness: -80 });

    // Run several ticks to see decline
    let current = d;
    for (let i = 0; i < 20; i++) {
      current = tickDemographics(current, modifiers);
    }
    expect(current.totalPopulation).toBeLessThan(d.totalPopulation);
  });

  it('age groups still sum to total after a tick', () => {
    const d = createInitialDemographics(10000, 'teranos');
    const result = tickDemographics(d, makeDefaultModifiers());
    expect(sumAge(result)).toBe(result.totalPopulation);
  });

  it('working age population feeds from young over time', () => {
    const d = createInitialDemographics(10000, 'teranos');
    const modifiers = makeDefaultModifiers({ growthRate: 0, healthLevel: 100, happiness: 50 });

    // After a tick with no growth, young should decrease as some age up
    const result = tickDemographics(d, modifiers);
    expect(result.age.young).toBeLessThanOrEqual(d.age.young);
  });

  it('low happiness suppresses births', () => {
    const d = createInitialDemographics(10000, 'teranos');
    const happy = makeDefaultModifiers({ happiness: 50, growthRate: 1.0, healthLevel: 80 });
    const miserable = makeDefaultModifiers({ happiness: -80, growthRate: 1.0, healthLevel: 80 });

    const resultHappy = tickDemographics(d, happy);
    const resultMiserable = tickDemographics(d, miserable);

    expect(resultHappy.totalPopulation).toBeGreaterThan(resultMiserable.totalPopulation);
  });
});

// ---------------------------------------------------------------------------
// tickDemographics — vocation shifts
// ---------------------------------------------------------------------------

describe('tickDemographics — vocation distribution', () => {
  it('vocation distribution sums to working age after tick', () => {
    const d = createInitialDemographics(10000, 'teranos');
    const result = tickDemographics(d, makeDefaultModifiers());
    expect(sumVocations(result)).toBe(result.age.workingAge);
  });

  it('high education with research labs increases scientists', () => {
    const d = createInitialDemographics(10000, 'teranos');
    const modifiers = makeDefaultModifiers({
      educationLevel: 90,
      availableBuildings: ['research_lab', 'research_lab', 'research_lab'],
    });

    let current = d;
    for (let i = 0; i < 10; i++) {
      current = tickDemographics(current, modifiers);
    }

    expect(current.vocations.scientists).toBeGreaterThan(d.vocations.scientists);
  });

  it('low education limits specialist training', () => {
    const d = createInitialDemographics(10000, 'teranos');
    const highEd = makeDefaultModifiers({
      educationLevel: 90,
      availableBuildings: ['research_lab', 'research_lab'],
    });
    const lowEd = makeDefaultModifiers({
      educationLevel: 10,
      availableBuildings: ['research_lab', 'research_lab'],
    });

    let highEdResult = d;
    let lowEdResult = d;
    for (let i = 0; i < 10; i++) {
      highEdResult = tickDemographics(highEdResult, highEd);
      lowEdResult = tickDemographics(lowEdResult, lowEd);
    }

    expect(highEdResult.vocations.scientists).toBeGreaterThan(lowEdResult.vocations.scientists);
  });

  it('factory buildings drive demand for workers', () => {
    // Start with a small population so workers begin below demand threshold
    const d = createInitialDemographics(2000, 'teranos');
    const withFactories = makeDefaultModifiers({
      educationLevel: 70,
      availableBuildings: ['factory', 'factory', 'factory', 'factory', 'factory', 'mining_facility'],
    });
    const withoutFactories = makeDefaultModifiers({
      educationLevel: 70,
      availableBuildings: [],
    });

    let withF = d;
    let withoutF = d;
    for (let i = 0; i < 15; i++) {
      withF = tickDemographics(withF, withFactories);
      withoutF = tickDemographics(withoutF, withoutFactories);
    }

    // With factories demanding workers, the worker count should be higher
    // than a colony with no factory demand
    expect(withF.vocations.workers).toBeGreaterThan(withoutF.vocations.workers);
  });
});

// ---------------------------------------------------------------------------
// calculateEffectiveWorkers
// ---------------------------------------------------------------------------

describe('calculateEffectiveWorkers', () => {
  it('returns scientists for research_lab', () => {
    const d = createInitialDemographics(10000, 'teranos');
    const workers = calculateEffectiveWorkers(d, 'research_lab');
    expect(workers).toBe(d.vocations.scientists);
  });

  it('returns workers for factory', () => {
    const d = createInitialDemographics(10000, 'teranos');
    const workers = calculateEffectiveWorkers(d, 'factory');
    expect(workers).toBe(d.vocations.workers);
  });

  it('returns workers + partial military for shipyard', () => {
    const d = createInitialDemographics(10000, 'teranos');
    const workers = calculateEffectiveWorkers(d, 'shipyard');
    const expected = d.vocations.workers + Math.round(d.vocations.military * 0.5);
    expect(workers).toBe(expected);
  });

  it('returns merchants for trade_hub', () => {
    const d = createInitialDemographics(10000, 'teranos');
    const workers = calculateEffectiveWorkers(d, 'trade_hub');
    expect(workers).toBe(d.vocations.merchants);
  });

  it('returns military for military_academy', () => {
    const d = createInitialDemographics(10000, 'teranos');
    const workers = calculateEffectiveWorkers(d, 'military_academy');
    expect(workers).toBe(d.vocations.military);
  });

  it('returns medical for medical_bay', () => {
    const d = createInitialDemographics(10000, 'teranos');
    const workers = calculateEffectiveWorkers(d, 'medical_bay');
    expect(workers).toBe(d.vocations.medical);
  });

  it('returns administrators for communications_hub', () => {
    const d = createInitialDemographics(10000, 'teranos');
    const workers = calculateEffectiveWorkers(d, 'communications_hub');
    expect(workers).toBe(d.vocations.administrators);
  });

  it('returns general labour for unknown building types', () => {
    const d = createInitialDemographics(10000, 'teranos');
    const workers = calculateEffectiveWorkers(d, 'completely_unknown_building');
    expect(workers).toBe(d.vocations.general);
  });

  it('returns 0 workers for a zero-population planet', () => {
    const d = createInitialDemographics(0, 'teranos');
    const workers = calculateEffectiveWorkers(d, 'factory');
    expect(workers).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Governor personality — generation
// ---------------------------------------------------------------------------

describe('generateGovernor (personality)', () => {
  it('generates a governor with a non-empty name', () => {
    const gov = generateGovernorPersonality('teranos', 42);
    expect(gov.name.trim().length).toBeGreaterThan(0);
  });

  it('sets the species ID correctly', () => {
    const gov = generateGovernorPersonality('orivani', 99);
    expect(gov.speciesId).toBe('orivani');
  });

  it('generates traits in the range 0-10', () => {
    for (let seed = 0; seed < 50; seed++) {
      const gov = generateGovernorPersonality('teranos', seed);
      const traitKeys = Object.keys(gov.traits) as (keyof typeof gov.traits)[];
      for (const key of traitKeys) {
        expect(gov.traits[key]).toBeGreaterThanOrEqual(0);
        expect(gov.traits[key]).toBeLessThanOrEqual(10);
      }
    }
  });

  it('generates loyalty in range 0-100', () => {
    for (let seed = 0; seed < 50; seed++) {
      const gov = generateGovernorPersonality('teranos', seed);
      expect(gov.loyalty).toBeGreaterThanOrEqual(0);
      expect(gov.loyalty).toBeLessThanOrEqual(100);
    }
  });

  it('generates corruption in range 0-100', () => {
    for (let seed = 0; seed < 50; seed++) {
      const gov = generateGovernorPersonality('teranos', seed);
      expect(gov.corruption).toBeGreaterThanOrEqual(0);
      expect(gov.corruption).toBeLessThanOrEqual(100);
    }
  });

  it('generates competence in range 30-90', () => {
    for (let seed = 0; seed < 50; seed++) {
      const gov = generateGovernorPersonality('teranos', seed);
      expect(gov.competence).toBeGreaterThanOrEqual(30);
      expect(gov.competence).toBeLessThanOrEqual(90);
    }
  });

  it('produces different governors with different seeds', () => {
    const gov1 = generateGovernorPersonality('teranos', 1);
    const gov2 = generateGovernorPersonality('teranos', 2);
    const same = gov1.name === gov2.name
      && JSON.stringify(gov1.traits) === JSON.stringify(gov2.traits);
    expect(same).toBe(false);
  });

  it('authoritarian and humanitarian are somewhat opposed', () => {
    // Over many seeds, we should never see both above 6
    let bothHighCount = 0;
    for (let seed = 0; seed < 200; seed++) {
      const gov = generateGovernorPersonality('teranos', seed);
      if (gov.traits.authoritarian > 6 && gov.traits.humanitarian > 6) {
        bothHighCount++;
      }
    }
    // It's possible but should be very rare after the opposition adjustment
    expect(bothHighCount).toBeLessThan(10);
  });
});

// ---------------------------------------------------------------------------
// Governor personality — modifier calculation
// ---------------------------------------------------------------------------

describe('calculateGovernorModifiers', () => {
  it('returns multipliers >= 1.0 for positive traits', () => {
    const gov = generateGovernorPersonality('teranos', 42);
    const mods = calculateGovernorModifiers(gov);
    expect(mods.productionMultiplier).toBeGreaterThanOrEqual(1.0);
    expect(mods.researchMultiplier).toBeGreaterThanOrEqual(1.0);
    expect(mods.militaryMultiplier).toBeGreaterThanOrEqual(1.0);
    expect(mods.tradeMultiplier).toBeGreaterThanOrEqual(1.0);
  });

  it('corruption drain is between 0.0 and 0.15', () => {
    for (let seed = 0; seed < 50; seed++) {
      const gov = generateGovernorPersonality('teranos', seed);
      const mods = calculateGovernorModifiers(gov);
      expect(mods.corruptionDrain).toBeGreaterThanOrEqual(0.0);
      expect(mods.corruptionDrain).toBeLessThanOrEqual(0.15);
    }
  });

  it('high industrialist trait produces higher production multiplier', () => {
    const gov1 = generateGovernorPersonality('teranos', 42);
    // Force high industrialist
    const highIndustry = {
      ...gov1,
      traits: { ...gov1.traits, industrialist: 10 },
      competence: 80,
    };
    const lowIndustry = {
      ...gov1,
      traits: { ...gov1.traits, industrialist: 1 },
      competence: 80,
    };

    const modsHigh = calculateGovernorModifiers(highIndustry);
    const modsLow = calculateGovernorModifiers(lowIndustry);

    expect(modsHigh.productionMultiplier).toBeGreaterThan(modsLow.productionMultiplier);
  });

  it('high intellectual trait produces higher research multiplier', () => {
    const gov1 = generateGovernorPersonality('teranos', 42);
    const highIntellect = {
      ...gov1,
      traits: { ...gov1.traits, intellectual: 10 },
      competence: 80,
    };
    const lowIntellect = {
      ...gov1,
      traits: { ...gov1.traits, intellectual: 1 },
      competence: 80,
    };

    const modsHigh = calculateGovernorModifiers(highIntellect);
    const modsLow = calculateGovernorModifiers(lowIntellect);

    expect(modsHigh.researchMultiplier).toBeGreaterThan(modsLow.researchMultiplier);
  });

  it('zero competence produces multipliers near 1.0', () => {
    const gov = {
      ...generateGovernorPersonality('teranos', 42),
      competence: 0,
      corruption: 0,
    };
    const mods = calculateGovernorModifiers(gov);
    expect(mods.productionMultiplier).toBeCloseTo(1.0, 2);
    expect(mods.researchMultiplier).toBeCloseTo(1.0, 2);
  });
});

// ---------------------------------------------------------------------------
// Governor personality — loyalty evolution
// ---------------------------------------------------------------------------

describe('tickGovernorLoyalty', () => {
  it('does not mutate the original governor', () => {
    const gov = generateGovernorPersonality('teranos', 42);
    const originalLoyalty = gov.loyalty;
    tickGovernorLoyalty(gov, 50, false, 0);
    expect(gov.loyalty).toBe(originalLoyalty);
  });

  it('high empire happiness increases loyalty', () => {
    const gov = generateGovernorPersonality('teranos', 42);
    const result = tickGovernorLoyalty(gov, 50, false, 0);
    expect(result.loyalty).toBeGreaterThanOrEqual(gov.loyalty);
  });

  it('low empire happiness decreases loyalty', () => {
    const gov = { ...generateGovernorPersonality('teranos', 42), loyalty: 60, corruption: 0 };
    // Make sure traits don't interfere
    gov.traits.militarist = 3;
    gov.traits.humanitarian = 3;
    gov.traits.charismatic = 3;
    gov.traits.authoritarian = 3;

    const result = tickGovernorLoyalty(gov, -50, false, 0);
    expect(result.loyalty).toBeLessThan(gov.loyalty);
  });

  it('militarist governors gain loyalty during war', () => {
    const gov = { ...generateGovernorPersonality('teranos', 42), loyalty: 50, corruption: 0 };
    gov.traits.militarist = 8;
    gov.traits.humanitarian = 2;

    const peacetime = tickGovernorLoyalty(gov, 0, false, 0);
    const wartime = tickGovernorLoyalty(gov, 0, true, 0);

    expect(wartime.loyalty).toBeGreaterThan(peacetime.loyalty);
  });

  it('loyalty stays clamped between 0 and 100', () => {
    const gov = { ...generateGovernorPersonality('teranos', 42), loyalty: 99 };
    const result = tickGovernorLoyalty(gov, 80, false, 20);
    expect(result.loyalty).toBeLessThanOrEqual(100);
    expect(result.loyalty).toBeGreaterThanOrEqual(0);

    const gov2 = { ...generateGovernorPersonality('teranos', 42), loyalty: 1, corruption: 50 };
    gov2.traits.authoritarian = 9;
    gov2.traits.charismatic = 1;
    const result2 = tickGovernorLoyalty(gov2, -80, true, 0);
    expect(result2.loyalty).toBeGreaterThanOrEqual(0);
  });

  it('popularity stays clamped between -100 and 100', () => {
    const gov = { ...generateGovernorPersonality('teranos', 42), popularity: 98 };
    gov.traits.charismatic = 10;
    const result = tickGovernorLoyalty(gov, 80, false, 0);
    expect(result.popularity).toBeLessThanOrEqual(100);
  });
});
