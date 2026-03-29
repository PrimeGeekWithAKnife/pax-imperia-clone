import { describe, it, expect } from 'vitest';
import {
  generateMinorSpecies,
  discoverMinorSpecies,
  checkRevolt,
  processMinorSpeciesTick,
  BASE_REVOLT_CHANCE,
  REVOLT_ESCALATION_PER_POINT,
  REVOLT_LOYALTY_THRESHOLD,
  INTEGRATION_LOYALTY_GAIN,
  INTEGRATION_LOYALTY_DECAY,
} from '../engine/minor-species.js';
import type { MinorSpecies, IntegrationProgress } from '../types/minor-species.js';

// ---------------------------------------------------------------------------
// Deterministic RNG
// ---------------------------------------------------------------------------

function makeRng(initialSeed = 42) {
  let seed = initialSeed;
  return () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return seed / 2147483647;
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeIntegratedSpecies(
  loyalty: number,
  overrides: Partial<MinorSpecies> = {},
): MinorSpecies {
  return {
    id: 'species_test',
    name: 'Test Species',
    description: 'A test species for unit tests.',
    planetId: 'planet_1',
    systemId: 'sys_1',
    population: 50_000,
    techLevel: 'iron_age',
    biology: 'carbon_terrestrial',
    traits: {
      aggression: 5,
      curiosity: 5,
      industriousness: 5,
      adaptability: 5,
    },
    attitude: 10,
    status: 'integrated',
    properties: [],
    integration: {
      empireId: 'emp_1',
      ticksIntegrated: 10,
      loyalty,
      revoltRisk: 0,
      culturalExchange: 10,
      stage: 'early',
    },
    uplift: null,
    revolt: null,
    interactingEmpireId: 'emp_1',
    currentInteraction: 'integrate',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Minor species engine', () => {

  // ── generateMinorSpecies ─────────────────────────────────────────────────

  describe('generateMinorSpecies', () => {
    it('creates a valid species with all required fields', () => {
      const rng = makeRng(42);
      const species = generateMinorSpecies('planet_1', 'sys_1', rng);

      expect(species.id).toBeTruthy();
      expect(species.name).toBeTruthy();
      expect(species.description).toBeTruthy();
      expect(species.planetId).toBe('planet_1');
      expect(species.systemId).toBe('sys_1');
      expect(species.population).toBeGreaterThan(0);
      expect(species.status).toBe('undiscovered');
      expect(species.attitude).toBe(0);
      expect(species.integration).toBeNull();
      expect(species.uplift).toBeNull();
      expect(species.revolt).toBeNull();
    });

    it('assigns valid traits in the 1-10 range', () => {
      const rng = makeRng(123);
      const species = generateMinorSpecies('planet_2', 'sys_2', rng);

      expect(species.traits.aggression).toBeGreaterThanOrEqual(1);
      expect(species.traits.aggression).toBeLessThanOrEqual(10);
      expect(species.traits.curiosity).toBeGreaterThanOrEqual(1);
      expect(species.traits.curiosity).toBeLessThanOrEqual(10);
      expect(species.traits.industriousness).toBeGreaterThanOrEqual(1);
      expect(species.traits.industriousness).toBeLessThanOrEqual(10);
      expect(species.traits.adaptability).toBeGreaterThanOrEqual(1);
      expect(species.traits.adaptability).toBeLessThanOrEqual(10);
    });

    it('assigns at least one unique property from biology templates', () => {
      const rng = makeRng(42);
      const species = generateMinorSpecies('planet_3', 'sys_3', rng);

      expect(species.properties.length).toBeGreaterThanOrEqual(1);
      for (const prop of species.properties) {
        expect(prop.id).toBeTruthy();
        expect(prop.label).toBeTruthy();
        expect(prop.category).toBeTruthy();
      }
    });

    it('produces deterministic results with the same seed', () => {
      const rng1 = makeRng(99);
      const rng2 = makeRng(99);

      const species1 = generateMinorSpecies('p1', 's1', rng1);
      const species2 = generateMinorSpecies('p1', 's1', rng2);

      expect(species1.name).toBe(species2.name);
      expect(species1.biology).toBe(species2.biology);
      expect(species1.techLevel).toBe(species2.techLevel);
      expect(species1.traits.aggression).toBe(species2.traits.aggression);
    });

    it('generates different species with different seeds', () => {
      const species1 = generateMinorSpecies('p1', 's1', makeRng(1));
      const species2 = generateMinorSpecies('p1', 's1', makeRng(999));

      // With very different seeds, at least some properties should differ
      const differs = species1.biology !== species2.biology
        || species1.techLevel !== species2.techLevel
        || species1.traits.aggression !== species2.traits.aggression;
      expect(differs).toBe(true);
    });
  });

  // ── discoverMinorSpecies ─────────────────────────────────────────────────

  describe('discoverMinorSpecies', () => {
    it('transitions status from undiscovered to observed', () => {
      const rng = makeRng(42);
      const species = generateMinorSpecies('planet_1', 'sys_1', rng);
      expect(species.status).toBe('undiscovered');

      const result = discoverMinorSpecies(species, 'emp_1');

      expect(result.species.status).toBe('observed');
      expect(result.species.interactingEmpireId).toBe('emp_1');
    });

    it('emits a discovery event with correct species information', () => {
      const rng = makeRng(42);
      const species = generateMinorSpecies('planet_1', 'sys_1', rng);

      const result = discoverMinorSpecies(species, 'emp_1');

      expect(result.events.length).toBe(1);
      const event = result.events[0];
      expect(event.type).toBe('minor_species_discovered');
      if (event.type === 'minor_species_discovered') {
        expect(event.empireId).toBe('emp_1');
        expect(event.speciesName).toBe(species.name);
        expect(event.biology).toBe(species.biology);
        expect(event.techLevel).toBe(species.techLevel);
      }
    });

    it('does nothing if species is already discovered', () => {
      const rng = makeRng(42);
      const species = generateMinorSpecies('planet_1', 'sys_1', rng);
      const discovered = discoverMinorSpecies(species, 'emp_1');

      // Try to discover again
      const result = discoverMinorSpecies(discovered.species, 'emp_2');

      // Status should remain observed, no events
      expect(result.species.status).toBe('observed');
      expect(result.events.length).toBe(0);
    });
  });

  // ── checkRevolt ──────────────────────────────────────────────────────────

  describe('checkRevolt', () => {
    it('uses escalating probability — higher unhappiness means higher revolt chance', () => {
      // Analytical check: confirm that the formula gives higher probability
      // to species with lower loyalty

      const highLoyaltySpecies = makeIntegratedSpecies(80); // Above threshold, no revolt possible
      const lowLoyaltySpecies = makeIntegratedSpecies(10);  // Far below threshold

      // With loyalty 80 (above threshold 30), unhappiness = 0
      // revoltChance ≈ BASE (0.01) + 0 + aggression/100 (0.05) = 0.06
      // With loyalty 10, unhappiness = 20
      // revoltChance ≈ 0.01 + (20 * 0.01) + 0.05 = 0.26

      // Run many trials
      let highLoyaltyRevolts = 0;
      let lowLoyaltyRevolts = 0;
      const trials = 1000;

      for (let seed = 1; seed <= trials; seed++) {
        const rng1 = makeRng(seed);
        const rng2 = makeRng(seed);

        if (checkRevolt(highLoyaltySpecies, rng1).revolting) highLoyaltyRevolts++;
        if (checkRevolt(lowLoyaltySpecies, rng2).revolting) lowLoyaltyRevolts++;
      }

      // Low loyalty species should revolt more often
      expect(lowLoyaltyRevolts).toBeGreaterThan(highLoyaltyRevolts);
    });

    it('enslaved species have an additional revolt probability bonus', () => {
      const integrated = makeIntegratedSpecies(20, { status: 'integrated' });
      const enslaved = makeIntegratedSpecies(20, { status: 'enslaved' });

      let integratedRevolts = 0;
      let enslavedRevolts = 0;
      const trials = 1000;

      for (let seed = 1; seed <= trials; seed++) {
        if (checkRevolt(integrated, makeRng(seed)).revolting) integratedRevolts++;
        if (checkRevolt(enslaved, makeRng(seed)).revolting) enslavedRevolts++;
      }

      expect(enslavedRevolts).toBeGreaterThan(integratedRevolts);
    });

    it('returns no revolt for species that are not integrated, exploited, or enslaved', () => {
      const rng = makeRng(42);
      const undiscovered = makeIntegratedSpecies(0, { status: 'undiscovered' });
      const observed = makeIntegratedSpecies(0, { status: 'observed' });

      expect(checkRevolt(undiscovered, rng).revolting).toBe(false);
      expect(checkRevolt(observed, makeRng(43)).revolting).toBe(false);
    });

    it('provides a cause string when revolt occurs', () => {
      // Force a revolt with very low loyalty and a co-operative RNG
      const species = makeIntegratedSpecies(0, {
        status: 'enslaved',
        attitude: -90,
        traits: { aggression: 10, curiosity: 1, industriousness: 1, adaptability: 1 },
      });

      // Try many seeds until we get a revolt
      for (let seed = 1; seed <= 100; seed++) {
        const result = checkRevolt(species, makeRng(seed));
        if (result.revolting) {
          expect(result.cause.length).toBeGreaterThan(0);
          expect(result.strength).toBeGreaterThan(0);
          return; // Test passed
        }
      }
      // If we get here with a highly aggressive enslaved species, something is wrong
      expect.fail('Expected at least one revolt in 100 trials with maximum hostility');
    });
  });

  // ── Integration loyalty drift ────────────────────────────────────────────

  describe('Integration loyalty drift', () => {
    it('loyalty increases over time when attitude is positive', () => {
      const species = makeIntegratedSpecies(50, { attitude: 30 });
      const rng = makeRng(42);

      let current = species;
      for (let tick = 1; tick <= 20; tick++) {
        const result = processMinorSpeciesTick(current, 'emp_1', tick, rng);
        current = result.species;
      }

      expect(current.integration!.loyalty).toBeGreaterThan(species.integration!.loyalty);
    });

    it('loyalty decreases over time when attitude is negative', () => {
      const species = makeIntegratedSpecies(50, { attitude: -30 });
      const rng = makeRng(42);

      let current = species;
      for (let tick = 1; tick <= 20; tick++) {
        const result = processMinorSpeciesTick(current, 'emp_1', tick, rng);
        current = result.species;
      }

      expect(current.integration!.loyalty).toBeLessThan(species.integration!.loyalty);
    });

    it('cultural exchange accumulates over integration ticks', () => {
      const species = makeIntegratedSpecies(60, { attitude: 20 });
      const rng = makeRng(42);

      let current = species;
      for (let tick = 1; tick <= 30; tick++) {
        const result = processMinorSpeciesTick(current, 'emp_1', tick, rng);
        current = result.species;
      }

      expect(current.integration!.culturalExchange).toBeGreaterThan(
        species.integration!.culturalExchange,
      );
    });

    it('integration ticks increment each tick', () => {
      const species = makeIntegratedSpecies(60);
      const rng = makeRng(42);
      const initialTicks = species.integration!.ticksIntegrated;

      const result = processMinorSpeciesTick(species, 'emp_1', 1, rng);

      expect(result.species.integration!.ticksIntegrated).toBe(initialTicks + 1);
    });

    it('loyalty remains clamped between 0 and 100', () => {
      // Very high loyalty with positive attitude
      const highSpecies = makeIntegratedSpecies(99, { attitude: 100 });
      const rng1 = makeRng(42);

      let current1 = highSpecies;
      for (let tick = 1; tick <= 50; tick++) {
        const result = processMinorSpeciesTick(current1, 'emp_1', tick, rng1);
        current1 = result.species;
      }
      expect(current1.integration!.loyalty).toBeLessThanOrEqual(100);
      expect(current1.integration!.loyalty).toBeGreaterThanOrEqual(0);

      // Very low loyalty with negative attitude
      const lowSpecies = makeIntegratedSpecies(1, {
        attitude: -100,
        traits: { aggression: 10, curiosity: 1, industriousness: 1, adaptability: 1 },
      });
      const rng2 = makeRng(42);

      let current2 = lowSpecies;
      for (let tick = 1; tick <= 50; tick++) {
        const result = processMinorSpeciesTick(current2, 'emp_1', tick, rng2);
        current2 = result.species;
        // If revolt happens, the species status changes — break
        if (current2.status === 'revolting') break;
      }

      if (current2.integration) {
        expect(current2.integration.loyalty).toBeGreaterThanOrEqual(0);
        expect(current2.integration.loyalty).toBeLessThanOrEqual(100);
      }
    });
  });
});
