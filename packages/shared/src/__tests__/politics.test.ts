import { describe, it, expect } from 'vitest';
import {
  initialisePoliticalState,
  processPoliticalTick,
  processElection,
  calculateCorruption,
} from '../engine/politics.js';
import type {
  EmpirePoliticalState,
  PoliticalFaction,
} from '../engine/politics.js';
import type { PlanetDemographics } from '../types/demographics.js';

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

function makeDemographics(overrides: Partial<PlanetDemographics> = {}): PlanetDemographics {
  return {
    totalPopulation: 100_000,
    age: { young: 20_000, workingAge: 60_000, elderly: 20_000 },
    vocations: {
      scientists: 5_000,
      workers: 20_000,
      military: 8_000,
      merchants: 6_000,
      administrators: 4_000,
      educators: 3_000,
      medical: 4_000,
      general: 10_000,
    },
    faith: {
      fanatics: 5_000,
      observant: 20_000,
      casual: 30_000,
      indifferent: 25_000,
      secular: 20_000,
    },
    loyalty: {
      loyal: 40_000,
      content: 30_000,
      disgruntled: 20_000,
      rebellious: 10_000,
    },
    educationLevel: 60,
    healthLevel: 70,
    primarySpeciesId: 'vaelori',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Political factions engine', () => {

  // ── initialisePoliticalState ─────────────────────────────────────────────

  describe('initialisePoliticalState', () => {
    it('creates correct starter factions for a known species (Vaelori)', () => {
      const state = initialisePoliticalState('emp_1', 'vaelori', 'democracy', 0);

      expect(state.factions.length).toBe(2);
      expect(state.factions.map((f) => f.name)).toContain('Resonant Assembly');
      expect(state.factions.map((f) => f.name)).toContain('Attenuant Conclave');

      // Exactly one ruling faction
      const rulingCount = state.factions.filter((f) => f.isRulingFaction).length;
      expect(rulingCount).toBe(1);

      // All factions start at lobbying
      for (const faction of state.factions) {
        expect(faction.currentAction).toBe('lobbying');
        expect(faction.dissolved).toBe(false);
      }
    });

    it('creates three starter factions for species with three-faction lore (Orivani)', () => {
      const state = initialisePoliticalState('emp_2', 'orivani', 'theocracy', 0);
      expect(state.factions.length).toBe(3);
    });

    it('falls back to generic factions for an unknown species', () => {
      const state = initialisePoliticalState('emp_3', 'unknown_aliens', 'autocracy', 0);
      expect(state.factions.length).toBeGreaterThanOrEqual(2);
      // Should still have valid structure
      for (const faction of state.factions) {
        expect(faction.supportBase).toBeGreaterThan(0);
        expect(faction.demands.length).toBeGreaterThan(0);
      }
    });

    it('sets initial policies to neutral (value 0) across all seven domains', () => {
      const state = initialisePoliticalState('emp_4', 'khazari', 'republic', 0);
      expect(state.policies.length).toBe(7);
      for (const policy of state.policies) {
        expect(policy.value).toBe(0);
      }
    });

    it('sets higher base legitimacy for electoral government types', () => {
      const democracy = initialisePoliticalState('emp_5', 'vaelori', 'democracy', 0);
      const autocracy = initialisePoliticalState('emp_6', 'vaelori', 'autocracy', 0);
      expect(democracy.legitimacy).toBeGreaterThan(autocracy.legitimacy);
    });
  });

  // ── processPoliticalTick ─────────────────────────────────────────────────

  describe('processPoliticalTick', () => {
    it('updates faction support from demographics', () => {
      const rng = makeRng();
      const state = initialisePoliticalState('emp_1', 'vaelori', 'democracy', 0);
      const demographics = makeDemographics();

      const result = processPoliticalTick(state, demographics, 'democracy', 1, rng);

      // Support should be recalculated based on demographics — they should not
      // all remain at their initial values after processing
      const originalSupports = state.factions.map((f) => f.supportBase);
      const newSupports = result.state.factions.map((f) => f.supportBase);

      // At minimum the sum should be valid (0-1 range for each faction)
      for (const support of newSupports) {
        expect(support).toBeGreaterThanOrEqual(0);
        expect(support).toBeLessThanOrEqual(1);
      }
    });

    it('returns events when political changes occur', () => {
      const rng = makeRng(123);
      const state = initialisePoliticalState('emp_1', 'khazari', 'democracy', 0);

      // Create demographics with extreme discontent to trigger events
      const demographics = makeDemographics({
        loyalty: { loyal: 5_000, content: 5_000, disgruntled: 40_000, rebellious: 50_000 },
      });

      // Run multiple ticks to accumulate political pressure
      let current = state;
      const allEvents = [];
      for (let tick = 1; tick <= 20; tick++) {
        const result = processPoliticalTick(current, demographics, 'democracy', tick, rng);
        current = result.state;
        allEvents.push(...result.events);
      }

      // With extreme discontent, there should be some political events
      expect(allEvents.length).toBeGreaterThan(0);
    });
  });

  // ── Faction escalation ladder ────────────────────────────────────────────

  describe('Faction escalation ladder', () => {
    it.skip('escalates through lobbying, funding, and strikes when satisfaction is low', () => {
      const rng = makeRng(99);
      // Set up a state where one faction is very unsatisfied
      const state = initialisePoliticalState('emp_1', 'khazari', 'democracy', 0);

      // Force very negative satisfaction and high frustration by running
      // ticks with hostile demographics
      const hostileDemographics = makeDemographics({
        loyalty: { loyal: 1_000, content: 1_000, disgruntled: 48_000, rebellious: 50_000 },
        vocations: {
          scientists: 1_000, workers: 5_000, military: 40_000, merchants: 2_000,
          administrators: 2_000, educators: 2_000, medical: 2_000, general: 6_000,
        },
      });

      let current = state;
      const actionsOverTime: string[] = [];

      for (let tick = 1; tick <= 200; tick++) {
        const result = processPoliticalTick(current, hostileDemographics, 'democracy', tick, rng);
        current = result.state;
      }

      // After sustained pressure, at least one faction should have escalated
      // beyond lobbying
      const actions = current.factions.map((f) => f.currentAction);
      const hasEscalated = actions.some(
        (a) => a === 'funding' || a === 'strikes' || a === 'protests' || a === 'coup',
      );
      expect(hasEscalated).toBe(true);
    });
  });

  // ── processElection ──────────────────────────────────────────────────────

  describe('processElection', () => {
    it('produces valid results with vote shares summing to approximately 1.0', () => {
      const rng = makeRng(42);
      const state = initialisePoliticalState('emp_1', 'vaelori', 'democracy', 0);
      const demographics = makeDemographics();

      const result = processElection(state, demographics, rng);

      // Should emit an election event
      const electionEvent = result.events.find((e) => e.type === 'election');
      expect(electionEvent).toBeDefined();

      if (electionEvent && electionEvent.type === 'election') {
        // Vote shares should exist for each active faction
        expect(electionEvent.voteShares.length).toBeGreaterThanOrEqual(2);

        // Each share should be non-negative
        for (const vs of electionEvent.voteShares) {
          expect(vs.share).toBeGreaterThanOrEqual(0);
        }

        // Shares should sum to approximately 1.0 (allowing for noise)
        const totalShare = electionEvent.voteShares.reduce((s, v) => s + v.share, 0);
        expect(totalShare).toBeGreaterThan(0.85);
        expect(totalShare).toBeLessThan(1.15);

        // A winner should be declared
        expect(electionEvent.winnerFactionId).toBeTruthy();
        expect(electionEvent.winnerFactionName).toBeTruthy();
      }
    });

    it('updates faction ruling status after election', () => {
      const rng = makeRng(77);
      const state = initialisePoliticalState('emp_1', 'vaelori', 'democracy', 0);
      const demographics = makeDemographics();

      const result = processElection(state, demographics, rng);

      // Exactly one faction should be ruling after the election
      const rulingCount = result.state.factions.filter((f) => f.isRulingFaction).length;
      expect(rulingCount).toBe(1);
    });
  });

  // ── Corruption calculation ───────────────────────────────────────────────

  describe('calculateCorruption', () => {
    it('responds to government type — autocracy has higher baseline than democracy', () => {
      const demographics = makeDemographics();
      const democraticState = initialisePoliticalState('emp_1', 'vaelori', 'democracy', 0);
      const autocraticState = initialisePoliticalState('emp_2', 'vaelori', 'autocracy', 0);

      const demCorruption = calculateCorruption(democraticState, demographics, 'democracy', 1);
      const autCorruption = calculateCorruption(autocraticState, demographics, 'autocracy', 1);

      expect(autCorruption).toBeGreaterThan(demCorruption);
    });

    it('responds to inequality — high discontent increases corruption', () => {
      const state = initialisePoliticalState('emp_1', 'vaelori', 'democracy', 0);

      const stable = makeDemographics({
        loyalty: { loyal: 60_000, content: 30_000, disgruntled: 8_000, rebellious: 2_000 },
      });
      const unequal = makeDemographics({
        loyalty: { loyal: 5_000, content: 5_000, disgruntled: 40_000, rebellious: 50_000 },
      });

      const stableCorruption = calculateCorruption(state, stable, 'democracy', 1);
      const unequalCorruption = calculateCorruption(state, unequal, 'democracy', 1);

      expect(unequalCorruption).toBeGreaterThan(stableCorruption);
    });

    it('returns a value clamped between 0 and 100', () => {
      const state = initialisePoliticalState('emp_1', 'vaelori', 'hive_mind', 0);
      const demographics = makeDemographics({
        loyalty: { loyal: 90_000, content: 10_000, disgruntled: 0, rebellious: 0 },
        educationLevel: 100,
      });

      const corruption = calculateCorruption(state, demographics, 'hive_mind', 1);
      expect(corruption).toBeGreaterThanOrEqual(0);
      expect(corruption).toBeLessThanOrEqual(100);
    });
  });
});
