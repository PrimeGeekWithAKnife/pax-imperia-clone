import { describe, it, expect } from 'vitest';
import {
  generateAnomaliesForSystem,
  beginExcavation,
  progressExcavation,
  generatePrecursorBreadcrumb,
  STAGE_DURATIONS,
} from '../engine/anomaly.js';
import type { ExcavationSite } from '../engine/anomaly.js';
import type { Anomaly, ExcavationStage } from '../types/anomaly.js';
import type { Planet } from '../types/galaxy.js';

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

function makePlanet(overrides: Partial<Planet> = {}): Planet {
  return {
    id: 'planet_1',
    name: 'Test Planet',
    orbitalIndex: 1,
    type: 'terran',
    atmosphere: 'oxygen_nitrogen',
    gravity: 1.0,
    temperature: 293,
    naturalResources: 80,
    maxPopulation: 10,
    currentPopulation: 0,
    ownerId: null,
    buildings: [],
    productionQueue: [],
    ...overrides,
  };
}

function makeAnomaly(overrides: Partial<Anomaly> = {}): Anomaly {
  return {
    id: 'anomaly_1',
    type: 'precursor_ruins',
    name: 'Shattered Citadel',
    description: 'Ancient ruins of unknown origin.',
    systemId: 'sys_1',
    discovered: false,
    investigated: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Anomaly investigation engine', () => {

  // ── generateAnomaliesForSystem ───────────────────────────────────────────

  describe('generateAnomaliesForSystem', () => {
    it('creates anomalies for a system with planets', () => {
      const rng = makeRng(42);
      const planets = [
        makePlanet({ id: 'p1', naturalResources: 90, type: 'volcanic' }),
        makePlanet({ id: 'p2', naturalResources: 70, type: 'barren' }),
        makePlanet({ id: 'p3', naturalResources: 50, type: 'terran' }),
      ];

      const anomalies = generateAnomaliesForSystem('sys_test', planets, rng);

      expect(anomalies.length).toBeGreaterThan(0);

      // All anomalies should belong to the correct system
      for (const a of anomalies) {
        expect(a.systemId).toBe('sys_test');
        expect(a.discovered).toBe(false);
        expect(a.investigated).toBe(false);
        expect(a.id).toBeTruthy();
        expect(a.name).toBeTruthy();
        expect(a.description).toBeTruthy();
      }
    });

    it('produces deterministic results with the same seed', () => {
      const planets = [
        makePlanet({ id: 'p1', naturalResources: 80, type: 'volcanic' }),
        makePlanet({ id: 'p2', naturalResources: 60 }),
      ];

      const rng1 = makeRng(123);
      const rng2 = makeRng(123);

      const anomalies1 = generateAnomaliesForSystem('sys_a', planets, rng1);
      const anomalies2 = generateAnomaliesForSystem('sys_a', planets, rng2);

      // Same number of anomalies and same types
      expect(anomalies1.length).toBe(anomalies2.length);
      for (let i = 0; i < anomalies1.length; i++) {
        expect(anomalies1[i].type).toBe(anomalies2[i].type);
        expect(anomalies1[i].name).toBe(anomalies2[i].name);
      }
    });

    it('returns an empty array when given no planets', () => {
      const rng = makeRng();
      const anomalies = generateAnomaliesForSystem('sys_empty', [], rng);
      expect(anomalies.length).toBe(0);
    });

    it('higher resource planets tend to generate more anomalies', () => {
      // Run multiple times and compare averages
      let richCount = 0;
      let poorCount = 0;

      for (let seed = 1; seed <= 50; seed++) {
        const rng1 = makeRng(seed);
        const rng2 = makeRng(seed + 10000);

        const rich = generateAnomaliesForSystem(
          'sys_r', [makePlanet({ naturalResources: 100, type: 'volcanic' })], rng1,
        );
        const poor = generateAnomaliesForSystem(
          'sys_p', [makePlanet({ naturalResources: 10, type: 'terran' })], rng2,
        );
        richCount += rich.length;
        poorCount += poor.length;
      }

      // On average, richer planets should yield more anomalies
      expect(richCount).toBeGreaterThan(poorCount);
    });
  });

  // ── beginExcavation ──────────────────────────────────────────────────────

  describe('beginExcavation', () => {
    it('starts at the surface_survey stage', () => {
      const rng = makeRng();
      const anomaly = makeAnomaly();

      const site = beginExcavation(anomaly, 'ship_1', 'emp_1', rng);

      expect(site.currentStage).toBe('surface_survey');
      expect(site.assignedScienceShipId).toBe('ship_1');
      expect(site.discoveredByEmpireId).toBe('emp_1');
      expect(site.discovered).toBe(true);
      expect(site.investigated).toBe(false);
      expect(site.loreFragments.length).toBe(0);
    });

    it('inherits anomaly properties', () => {
      const rng = makeRng();
      const anomaly = makeAnomaly({ id: 'a_special', type: 'derelict_vessel', systemId: 'sys_5' });

      const site = beginExcavation(anomaly, 'ship_2', 'emp_2', rng);

      expect(site.id).toBe('a_special');
      expect(site.type).toBe('derelict_vessel');
      expect(site.systemId).toBe('sys_5');
    });

    it('initialises progress ticks for each excavation stage', () => {
      const rng = makeRng();
      const anomaly = makeAnomaly();
      const site = beginExcavation(anomaly, 'ship_1', 'emp_1', rng);

      // Surface survey, initial dig, deep excavation, and artefact recovery should have >0 ticks
      expect(site.progressPerStage.surface_survey).toBeGreaterThan(0);
      expect(site.progressPerStage.initial_dig).toBeGreaterThan(0);
      expect(site.progressPerStage.deep_excavation).toBeGreaterThan(0);
      expect(site.progressPerStage.artefact_recovery).toBeGreaterThan(0);

      // Undiscovered, detected, and complete should be 0
      expect(site.progressPerStage.undiscovered).toBe(0);
      expect(site.progressPerStage.detected).toBe(0);
      expect(site.progressPerStage.complete).toBe(0);
    });
  });

  // ── progressExcavation ───────────────────────────────────────────────────

  describe('progressExcavation', () => {
    it('advances ticks and eventually completes stages', () => {
      const rng = makeRng(42);
      const anomaly = makeAnomaly({ type: 'mineral_deposit' });
      let site = beginExcavation(anomaly, 'ship_1', 'emp_1', rng);

      // Clear any danger to avoid pausing
      site.dangerLevel = 0;
      site.dangerType = undefined;

      const initialTicks = site.progressPerStage.surface_survey;
      expect(initialTicks).toBeGreaterThan(0);

      // Progress one tick
      const rng2 = makeRng(100);
      const result = progressExcavation(site, rng2);

      // Should emit a progress event
      const progressEvent = result.events.find((e) => e.type === 'excavation_progress');
      expect(progressEvent).toBeDefined();
    });

    it('completes the surface_survey stage after enough ticks', () => {
      const rng = makeRng(42);
      const anomaly = makeAnomaly({ type: 'mineral_deposit' });
      let site = beginExcavation(anomaly, 'ship_1', 'emp_1', rng);

      // Clear danger
      site.dangerLevel = 0;
      site.dangerType = undefined;

      // Run enough ticks to complete the surface survey
      const ticksNeeded = site.progressPerStage.surface_survey + 5; // +5 for safety
      let allEvents: Array<{ type: string }> = [];

      for (let i = 0; i < ticksNeeded; i++) {
        const tickRng = makeRng(200 + i);
        const result = progressExcavation(site, tickRng);
        site = result.site;
        allEvents.push(...result.events);

        // If danger encountered, set risk choice to proceed
        if (site.dangerLevel > 0 && site.dangerType && !site.riskChoice) {
          site.riskChoice = 'proceed';
        }

        // Stop once we advance past surface_survey
        if (site.currentStage !== 'surface_survey') break;
      }

      // Stage should have advanced
      const stageComplete = allEvents.some((e) => e.type === 'excavation_stage_complete');
      expect(stageComplete).toBe(true);
    });

    it('pauses when danger is encountered and no risk choice is set', () => {
      const rng = makeRng(42);
      const anomaly = makeAnomaly({ type: 'precursor_ruins' });
      let site = beginExcavation(anomaly, 'ship_1', 'emp_1', rng);

      // Manually set danger to simulate an encounter
      site.dangerLevel = 50;
      site.dangerType = 'automated_defences';
      site.riskChoice = undefined;

      const result = progressExcavation(site, makeRng(100));

      // No progress should be made
      expect(result.site.progressPerStage.surface_survey).toBe(
        site.progressPerStage.surface_survey,
      );
    });
  });

  // ── generatePrecursorBreadcrumb ──────────────────────────────────────────

  describe('generatePrecursorBreadcrumb', () => {
    it('returns unique lore fragments based on excavation depth', () => {
      const rng = makeRng(42);
      const anomaly = makeAnomaly({ type: 'precursor_ruins' });
      const site = beginExcavation(anomaly, 'ship_1', 'emp_1', rng);

      // Test different stages
      const surfaceFragment = generatePrecursorBreadcrumb(
        { ...site, currentStage: 'surface_survey' as ExcavationStage },
        0,
      );
      const deepFragment = generatePrecursorBreadcrumb(
        { ...site, currentStage: 'deep_excavation' as ExcavationStage },
        5,
      );

      // Both should return non-empty strings
      expect(surfaceFragment.length).toBeGreaterThan(0);
      expect(deepFragment.length).toBeGreaterThan(0);

      // Different stages should yield different lore
      expect(surfaceFragment).not.toBe(deepFragment);
    });

    it('returns empty string for non-lore stages (undiscovered, detected, complete)', () => {
      const rng = makeRng(42);
      const anomaly = makeAnomaly({ type: 'precursor_ruins' });
      const site = beginExcavation(anomaly, 'ship_1', 'emp_1', rng);

      const undiscovered = generatePrecursorBreadcrumb(
        { ...site, currentStage: 'undiscovered' as ExcavationStage },
        0,
      );
      const complete = generatePrecursorBreadcrumb(
        { ...site, currentStage: 'complete' as ExcavationStage },
        0,
      );

      expect(undiscovered).toBe('');
      expect(complete).toBe('');
    });

    it('avoids duplicates within a single excavation site', () => {
      const rng = makeRng(42);
      const anomaly = makeAnomaly({ type: 'precursor_ruins' });
      const site = beginExcavation(anomaly, 'ship_1', 'emp_1', rng);

      // Get first fragment
      const fragment1 = generatePrecursorBreadcrumb(
        { ...site, currentStage: 'surface_survey' as ExcavationStage },
        0,
      );

      // Add it to collected fragments and try again
      const siteWithFragment = {
        ...site,
        currentStage: 'surface_survey' as ExcavationStage,
        loreFragments: [fragment1],
      };

      const fragment2 = generatePrecursorBreadcrumb(siteWithFragment, 1);

      // Should get a different fragment (or empty if all exhausted)
      if (fragment2.length > 0) {
        expect(fragment2).not.toBe(fragment1);
      }
    });

    it('different tick offsets yield different fragments at the same stage', () => {
      const rng = makeRng(42);
      const anomaly = makeAnomaly({ type: 'precursor_ruins' });
      const site = beginExcavation(anomaly, 'ship_1', 'emp_1', rng);

      const stageForTest = { ...site, currentStage: 'initial_dig' as ExcavationStage };

      const frag0 = generatePrecursorBreadcrumb(stageForTest, 0);
      const frag1 = generatePrecursorBreadcrumb(stageForTest, 1);

      // Different tick offsets should select different lore indices
      expect(frag0).not.toBe(frag1);
    });
  });
});
