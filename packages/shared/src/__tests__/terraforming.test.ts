/**
 * Tests for terraforming mechanics.
 *
 * Covers:
 * - Progress advances each tick when a station is present
 * - Higher station level = faster progress
 * - Stages progress in order (atmosphere → temperature → biosphere → complete)
 * - Planet type changes on completion
 * - No progress without a terraforming station
 * - Utility helpers (isTerraformable, getTerraformTarget, estimateTicksRemaining)
 */

import { describe, it, expect } from 'vitest';
import {
  processTerraformingTick,
  isTerraformable,
  getTerraformTarget,
  ticksForStage,
  estimateTicksRemaining,
  type TerraformingProgress,
} from '../engine/terraforming.js';
import type { Planet } from '../types/galaxy.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeBarrenPlanet(overrides: Partial<Planet> = {}): Planet {
  return {
    id: 'planet-1',
    name: 'New Eden',
    orbitalIndex: 2,
    type: 'barren',
    atmosphere: 'vacuum',
    gravity: 1.0,
    temperature: 220,
    naturalResources: 30,
    maxPopulation: 1_000_000,
    currentPopulation: 500_000,
    ownerId: 'empire-1',
    buildings: [],
    productionQueue: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// isTerraformable
// ---------------------------------------------------------------------------

describe('isTerraformable', () => {
  it('returns true for barren, desert, ice, toxic', () => {
    expect(isTerraformable('barren')).toBe(true);
    expect(isTerraformable('desert')).toBe(true);
    expect(isTerraformable('ice')).toBe(true);
    expect(isTerraformable('toxic')).toBe(true);
  });

  it('returns false for terran, ocean, volcanic, gas_giant', () => {
    expect(isTerraformable('terran')).toBe(false);
    expect(isTerraformable('ocean')).toBe(false);
    expect(isTerraformable('volcanic')).toBe(false);
    expect(isTerraformable('gas_giant')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getTerraformTarget
// ---------------------------------------------------------------------------

describe('getTerraformTarget', () => {
  it('returns terran for all terraformable types', () => {
    expect(getTerraformTarget('barren')).toBe('terran');
    expect(getTerraformTarget('desert')).toBe('terran');
    expect(getTerraformTarget('ice')).toBe('terran');
    expect(getTerraformTarget('toxic')).toBe('terran');
  });

  it('returns undefined for non-terraformable types', () => {
    expect(getTerraformTarget('terran')).toBeUndefined();
    expect(getTerraformTarget('gas_giant')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// ticksForStage
// ---------------------------------------------------------------------------

describe('ticksForStage', () => {
  it('requires 50 ticks for atmosphere at level 1', () => {
    // 100 / (2 * 1) = 50
    expect(ticksForStage('atmosphere', 1)).toBe(50);
  });

  it('requires 25 ticks for atmosphere at level 2', () => {
    // 100 / (2 * 2) = 25
    expect(ticksForStage('atmosphere', 2)).toBe(25);
  });

  it('requires ~67 ticks for temperature at level 1', () => {
    // ceil(100 / (1.5 * 1)) = 67
    expect(ticksForStage('temperature', 1)).toBe(67);
  });

  it('requires 100 ticks for biosphere at level 1', () => {
    expect(ticksForStage('biosphere', 1)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// processTerraformingTick — no station
// ---------------------------------------------------------------------------

describe('processTerraformingTick without station', () => {
  it('returns unchanged planet and null progress when no station', () => {
    const planet = makeBarrenPlanet();
    const result = processTerraformingTick(planet, false, 1, null);

    expect(result.planet).toBe(planet); // same reference — no change
    expect(result.progress).toBeNull();
    expect(result.event).toBeUndefined();
  });

  it('returns existing progress unchanged when station removed', () => {
    const planet = makeBarrenPlanet();
    const progress: TerraformingProgress = {
      planetId: 'planet-1',
      systemId: 'system-1',
      stage: 'atmosphere',
      progress: 40,
      targetType: 'terran',
    };

    const result = processTerraformingTick(planet, false, 1, progress);

    expect(result.planet).toBe(planet);
    expect(result.progress).toBe(progress); // unchanged
    expect(result.event).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// processTerraformingTick — non-terraformable planet
// ---------------------------------------------------------------------------

describe('processTerraformingTick on non-terraformable planet', () => {
  it('returns null progress for a terran planet', () => {
    const planet = makeBarrenPlanet({ type: 'terran' });
    const result = processTerraformingTick(planet, true, 1, null);

    expect(result.progress).toBeNull();
    expect(result.event).toBeUndefined();
  });

  it('returns null progress for a gas giant', () => {
    const planet = makeBarrenPlanet({ type: 'gas_giant' });
    const result = processTerraformingTick(planet, true, 1, null);

    expect(result.progress).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// processTerraformingTick — atmosphere stage
// ---------------------------------------------------------------------------

describe('processTerraformingTick atmosphere stage', () => {
  it('advances progress by 2 per tick at level 1', () => {
    const planet = makeBarrenPlanet();
    const result = processTerraformingTick(planet, true, 1, null);

    expect(result.progress).not.toBeNull();
    expect(result.progress!.stage).toBe('atmosphere');
    expect(result.progress!.progress).toBeCloseTo(2);
    expect(result.planet).toBe(planet); // planet unchanged within stage
  });

  it('advances progress by 4 per tick at level 2', () => {
    const planet = makeBarrenPlanet();
    const result = processTerraformingTick(planet, true, 2, null);

    expect(result.progress!.progress).toBeCloseTo(4);
  });

  it('advances progress faster at higher station levels', () => {
    const planet = makeBarrenPlanet();
    const resultLevel1 = processTerraformingTick(planet, true, 1, null);
    const resultLevel3 = processTerraformingTick(planet, true, 3, null);

    expect(resultLevel3.progress!.progress).toBeGreaterThan(
      resultLevel1.progress!.progress,
    );
  });

  it('preserves existing progress between ticks', () => {
    const planet = makeBarrenPlanet();
    const initial: TerraformingProgress = {
      planetId: 'planet-1',
      systemId: 'system-1',
      stage: 'atmosphere',
      progress: 50,
      targetType: 'terran',
    };

    const result = processTerraformingTick(planet, true, 1, initial);
    expect(result.progress!.progress).toBeCloseTo(52);
  });
});

// ---------------------------------------------------------------------------
// Stage completion — atmosphere → temperature
// ---------------------------------------------------------------------------

describe('atmosphere stage completion', () => {
  it('transitions to temperature stage when atmosphere progress reaches 100', () => {
    const planet = makeBarrenPlanet();
    const almostDone: TerraformingProgress = {
      planetId: 'planet-1',
      systemId: 'system-1',
      stage: 'atmosphere',
      progress: 99,
      targetType: 'terran',
    };

    const result = processTerraformingTick(planet, true, 1, almostDone);

    expect(result.progress!.stage).toBe('temperature');
    expect(result.progress!.progress).toBe(0);
  });

  it('updates the planet atmosphere to oxygen_nitrogen', () => {
    const planet = makeBarrenPlanet({ atmosphere: 'vacuum' });
    const almostDone: TerraformingProgress = {
      planetId: 'planet-1',
      systemId: 'system-1',
      stage: 'atmosphere',
      progress: 99,
      targetType: 'terran',
    };

    const result = processTerraformingTick(planet, true, 1, almostDone);

    expect(result.planet.atmosphere).toBe('oxygen_nitrogen');
    expect(result.planet).not.toBe(planet); // new reference
  });

  it('emits an event when atmosphere stage completes', () => {
    const planet = makeBarrenPlanet();
    const almostDone: TerraformingProgress = {
      planetId: 'planet-1',
      systemId: 'system-1',
      stage: 'atmosphere',
      progress: 99,
      targetType: 'terran',
    };

    const result = processTerraformingTick(planet, true, 1, almostDone);

    expect(result.event).toMatch(/atmosphere/i);
    expect(result.event).toContain(planet.name);
  });
});

// ---------------------------------------------------------------------------
// Stage completion — temperature → biosphere
// ---------------------------------------------------------------------------

describe('temperature stage completion', () => {
  it('transitions to biosphere stage', () => {
    const planet = makeBarrenPlanet();
    const almostDone: TerraformingProgress = {
      planetId: 'planet-1',
      systemId: 'system-1',
      stage: 'temperature',
      progress: 99,
      targetType: 'terran',
    };

    const result = processTerraformingTick(planet, true, 1, almostDone);

    expect(result.progress!.stage).toBe('biosphere');
    expect(result.progress!.progress).toBe(0);
  });

  it('sets planet temperature to 293K', () => {
    const planet = makeBarrenPlanet({ temperature: 150 });
    const almostDone: TerraformingProgress = {
      planetId: 'planet-1',
      systemId: 'system-1',
      stage: 'temperature',
      progress: 99,
      targetType: 'terran',
    };

    const result = processTerraformingTick(planet, true, 1, almostDone);

    expect(result.planet.temperature).toBe(293);
  });
});

// ---------------------------------------------------------------------------
// Stage completion — biosphere → complete
// ---------------------------------------------------------------------------

describe('biosphere stage completion', () => {
  it('transitions to complete stage', () => {
    const planet = makeBarrenPlanet();
    const almostDone: TerraformingProgress = {
      planetId: 'planet-1',
      systemId: 'system-1',
      stage: 'biosphere',
      progress: 99,
      targetType: 'terran',
    };

    const result = processTerraformingTick(planet, true, 1, almostDone);

    expect(result.progress!.stage).toBe('complete');
  });

  it('increases naturalResources by 20', () => {
    const planet = makeBarrenPlanet({ naturalResources: 30 });
    const almostDone: TerraformingProgress = {
      planetId: 'planet-1',
      systemId: 'system-1',
      stage: 'biosphere',
      progress: 99,
      targetType: 'terran',
    };

    const result = processTerraformingTick(planet, true, 1, almostDone);

    expect(result.planet.naturalResources).toBe(50);
  });

  it('increases maxPopulation', () => {
    const planet = makeBarrenPlanet({ maxPopulation: 1_000_000 });
    const almostDone: TerraformingProgress = {
      planetId: 'planet-1',
      systemId: 'system-1',
      stage: 'biosphere',
      progress: 99,
      targetType: 'terran',
    };

    const result = processTerraformingTick(planet, true, 1, almostDone);

    expect(result.planet.maxPopulation).toBeGreaterThan(planet.maxPopulation);
  });

  it('converts the planet type to terran on completion', () => {
    const planet = makeBarrenPlanet({ type: 'barren' });
    const almostDone: TerraformingProgress = {
      planetId: 'planet-1',
      systemId: 'system-1',
      stage: 'biosphere',
      progress: 99,
      targetType: 'terran',
    };

    const result = processTerraformingTick(planet, true, 1, almostDone);

    expect(result.planet.type).toBe('terran');
  });

  it('emits a TerraformingComplete event message on completion', () => {
    const planet = makeBarrenPlanet();
    const almostDone: TerraformingProgress = {
      planetId: 'planet-1',
      systemId: 'system-1',
      stage: 'biosphere',
      progress: 99,
      targetType: 'terran',
    };

    const result = processTerraformingTick(planet, true, 1, almostDone);

    expect(result.event).toMatch(/complete/i);
    expect(result.event).toContain(planet.name);
    expect(result.event).toContain('terran');
  });
});

// ---------------------------------------------------------------------------
// Complete stage — no further changes
// ---------------------------------------------------------------------------

describe('complete stage', () => {
  it('makes no further changes after completion', () => {
    const planet = makeBarrenPlanet({ type: 'terran' });
    const done: TerraformingProgress = {
      planetId: 'planet-1',
      systemId: 'system-1',
      stage: 'complete',
      progress: 100,
      targetType: 'terran',
    };

    const result = processTerraformingTick(planet, true, 1, done);

    expect(result.planet).toBe(planet);
    expect(result.progress).toBe(done);
    expect(result.event).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Different source planet types
// ---------------------------------------------------------------------------

describe('different starting planet types', () => {
  it('terraforms a desert planet to terran', () => {
    const planet = makeBarrenPlanet({ type: 'desert' });
    const almostDone: TerraformingProgress = {
      planetId: 'planet-1',
      systemId: 'system-1',
      stage: 'biosphere',
      progress: 99,
      targetType: 'terran',
    };

    const result = processTerraformingTick(planet, true, 1, almostDone);

    expect(result.planet.type).toBe('terran');
  });

  it('terraforms an ice planet to terran', () => {
    const planet = makeBarrenPlanet({ type: 'ice' });
    const almostDone: TerraformingProgress = {
      planetId: 'planet-1',
      systemId: 'system-1',
      stage: 'biosphere',
      progress: 99,
      targetType: 'terran',
    };

    const result = processTerraformingTick(planet, true, 1, almostDone);

    expect(result.planet.type).toBe('terran');
  });

  it('terraforms a toxic planet to terran', () => {
    const planet = makeBarrenPlanet({ type: 'toxic' });
    const almostDone: TerraformingProgress = {
      planetId: 'planet-1',
      systemId: 'system-1',
      stage: 'biosphere',
      progress: 99,
      targetType: 'terran',
    };

    const result = processTerraformingTick(planet, true, 1, almostDone);

    expect(result.planet.type).toBe('terran');
  });
});

// ---------------------------------------------------------------------------
// estimateTicksRemaining
// ---------------------------------------------------------------------------

describe('estimateTicksRemaining', () => {
  it('returns 0 for a complete terraforming project', () => {
    const progress: TerraformingProgress = {
      planetId: 'p1',
      systemId: 's1',
      stage: 'complete',
      progress: 100,
    };

    expect(estimateTicksRemaining(progress, 1)).toBe(0);
  });

  it('returns a positive number for an in-progress project', () => {
    const progress: TerraformingProgress = {
      planetId: 'p1',
      systemId: 's1',
      stage: 'atmosphere',
      progress: 0,
    };

    expect(estimateTicksRemaining(progress, 1)).toBeGreaterThan(0);
  });

  it('returns fewer ticks at higher station level', () => {
    const progress: TerraformingProgress = {
      planetId: 'p1',
      systemId: 's1',
      stage: 'atmosphere',
      progress: 0,
    };

    const ticksLevel1 = estimateTicksRemaining(progress, 1);
    const ticksLevel2 = estimateTicksRemaining(progress, 2);

    expect(ticksLevel2).toBeLessThan(ticksLevel1);
  });

  it('accounts for existing partial progress', () => {
    const fresh: TerraformingProgress = {
      planetId: 'p1',
      systemId: 's1',
      stage: 'atmosphere',
      progress: 0,
    };
    const halfway: TerraformingProgress = {
      ...fresh,
      progress: 50,
    };

    expect(estimateTicksRemaining(halfway, 1)).toBeLessThan(
      estimateTicksRemaining(fresh, 1),
    );
  });
});

// ---------------------------------------------------------------------------
// Full simulation: run through all stages automatically
// ---------------------------------------------------------------------------

describe('full terraforming simulation', () => {
  it('completes all stages after enough ticks at level 1', () => {
    const planet = makeBarrenPlanet({ type: 'barren', atmosphere: 'vacuum', temperature: 100 });
    let currentPlanet = planet;
    let progress: TerraformingProgress | null = null;

    // Run for more than enough ticks to complete all stages
    // Max needed: 50 (atm) + 67 (temp) + 100 (bio) = 217 ticks
    for (let i = 0; i < 300; i++) {
      const result = processTerraformingTick(currentPlanet, true, 1, progress);
      currentPlanet = result.planet;
      progress = result.progress;

      if (progress?.stage === 'complete') break;
    }

    expect(progress?.stage).toBe('complete');
    expect(currentPlanet.type).toBe('terran');
    expect(currentPlanet.atmosphere).toBe('oxygen_nitrogen');
    expect(currentPlanet.temperature).toBe(293);
    expect(currentPlanet.naturalResources).toBeGreaterThan(planet.naturalResources);
    expect(currentPlanet.maxPopulation).toBeGreaterThan(planet.maxPopulation);
  });

  it('completes faster at level 3', () => {
    function countTicks(stationLevel: number): number {
      const planet = makeBarrenPlanet();
      let currentPlanet = planet;
      let progress: TerraformingProgress | null = null;
      let ticks = 0;

      for (let i = 0; i < 1000; i++) {
        const result = processTerraformingTick(currentPlanet, true, stationLevel, progress);
        currentPlanet = result.planet;
        progress = result.progress;
        ticks++;
        if (progress?.stage === 'complete') break;
      }

      return ticks;
    }

    const ticksLevel1 = countTicks(1);
    const ticksLevel3 = countTicks(3);

    expect(ticksLevel3).toBeLessThan(ticksLevel1);
  });

  it('stages advance in correct order', () => {
    const planet = makeBarrenPlanet();
    let currentPlanet = planet;
    let progress: TerraformingProgress | null = null;
    const observedStages: string[] = [];
    let lastStage = '';

    for (let i = 0; i < 500; i++) {
      const result = processTerraformingTick(currentPlanet, true, 1, progress);
      currentPlanet = result.planet;
      progress = result.progress;

      if (progress && progress.stage !== lastStage) {
        observedStages.push(progress.stage);
        lastStage = progress.stage;
      }

      if (progress?.stage === 'complete') break;
    }

    expect(observedStages).toEqual(['atmosphere', 'temperature', 'biosphere', 'complete']);
  });
});
