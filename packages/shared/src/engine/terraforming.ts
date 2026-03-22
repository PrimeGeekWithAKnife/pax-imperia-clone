/**
 * Terraforming mechanics — pure functions for advancing and completing the
 * four-stage planetary terraforming process.
 *
 * Terraforming requires a Terraforming Station building on the planet.
 * Higher station levels accelerate progress.  All functions are side-effect-free
 * and return new objects rather than mutating their inputs.
 *
 * Stage order:
 *   atmosphere → temperature → biosphere → complete
 *
 * Each stage requires 100 progress points to complete.  Base ticks per stage
 * at level 1:
 *   atmosphere  ≈ 50 ticks (2 points/tick × level)
 *   temperature ≈ 67 ticks (1.5 points/tick × level)
 *   biosphere   ≈ 100 ticks (1 point/tick × level)
 *
 * On completion the planet type converts:
 *   barren | desert | ice | toxic → terran
 */

import type { Planet, AtmosphereType, PlanetType } from '../types/galaxy.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type TerraformingStage = 'atmosphere' | 'temperature' | 'biosphere' | 'complete';

/**
 * Persistent record of a planet's terraforming progress.
 * Store this alongside the planet in whatever state management layer you use.
 */
export interface TerraformingProgress {
  /** The planet being terraformed. */
  planetId: string;
  /** The star system containing the planet. */
  systemId: string;
  /** Which stage is currently underway. */
  stage: TerraformingStage;
  /** Progress within the current stage, 0–100. */
  progress: number;
  /** The planet type the planet will become when terraforming completes. */
  targetType?: PlanetType;
}

/**
 * The result of processing one terraforming tick.
 *
 * - `planet`   — updated planet (may be identical to input if no change yet)
 * - `progress` — updated progress record, or null if terraforming cannot run
 * - `event`    — human-readable notification string when a notable thing happens
 */
export interface TerraformingTickResult {
  planet: Planet;
  progress: TerraformingProgress | null;
  event?: string;
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/** Total progress points needed to complete each stage. */
const STAGE_COST = 100;

/** Points added to the current stage per tick per station level. */
const PROGRESS_PER_TICK: Record<TerraformingStage, number> = {
  atmosphere:  2,
  temperature: 1.5,
  biosphere:   1,
  complete:    0,
};

/** Stage ordering. */
const STAGE_ORDER: TerraformingStage[] = [
  'atmosphere',
  'temperature',
  'biosphere',
  'complete',
];

/** Target atmosphere after stage 1 completes. */
const TARGET_ATMOSPHERE: AtmosphereType = 'oxygen_nitrogen';

/** Target temperature (K) after stage 2 completes — Earth-normal. */
const TARGET_TEMPERATURE = 293;

/** How much naturalResources increases when the biosphere stage completes. */
const BIOSPHERE_RESOURCE_BONUS = 20;

/** How much maxPopulation increases when the biosphere stage completes (absolute). */
const BIOSPHERE_POPULATION_BONUS = 500_000;

/** Which planet types can be terraformed, and what they become. */
const TERRAFORMABLE_TYPES: Partial<Record<PlanetType, PlanetType>> = {
  barren:  'terran',
  desert:  'terran',
  ice:     'terran',
  toxic:   'terran',
};

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the given planet type can be terraformed.
 */
export function isTerraformable(type: PlanetType): boolean {
  return type in TERRAFORMABLE_TYPES;
}

/**
 * Returns the target planet type for the given origin type, or undefined if
 * the planet cannot be terraformed.
 */
export function getTerraformTarget(type: PlanetType): PlanetType | undefined {
  return TERRAFORMABLE_TYPES[type];
}

/**
 * Returns the number of ticks required to complete one stage at the given
 * station level (level must be >= 1).
 */
export function ticksForStage(stage: TerraformingStage, stationLevel: number): number {
  const rate = PROGRESS_PER_TICK[stage];
  if (rate === 0) return 0;
  return Math.ceil(STAGE_COST / (rate * stationLevel));
}

/**
 * Estimated ticks remaining until terraforming is fully complete, given the
 * current progress record and station level.
 */
export function estimateTicksRemaining(
  progress: TerraformingProgress,
  stationLevel: number,
): number {
  if (progress.stage === 'complete') return 0;

  const stageIndex = STAGE_ORDER.indexOf(progress.stage);
  let total = 0;

  for (let i = stageIndex; i < STAGE_ORDER.length - 1; i++) {
    const s = STAGE_ORDER[i]!;
    const full = ticksForStage(s, stationLevel);
    if (i === stageIndex) {
      // Partial progress already done on the current stage
      const remaining = Math.ceil(
        (STAGE_COST - progress.progress) / (PROGRESS_PER_TICK[s] * stationLevel),
      );
      total += remaining;
    } else {
      total += full;
    }
  }

  return total;
}

// ---------------------------------------------------------------------------
// Core tick processor
// ---------------------------------------------------------------------------

/**
 * Process one tick of terraforming for a single planet.
 *
 * @param planet               The current planet state.
 * @param hasTerraformingStation  Whether the planet has a Terraforming Station.
 * @param stationLevel         The level of the Terraforming Station (1–N).
 *                             Ignored when hasTerraformingStation is false.
 * @param existingProgress     The planet's existing progress record, or null
 *                             to begin a fresh terraforming project.
 * @returns                    Updated planet, progress record, and optional event.
 */
export function processTerraformingTick(
  planet: Planet,
  hasTerraformingStation: boolean,
  stationLevel: number,
  existingProgress: TerraformingProgress | null = null,
): TerraformingTickResult {
  // No station — nothing happens.
  if (!hasTerraformingStation) {
    return { planet, progress: existingProgress, event: undefined };
  }

  // If progress is already complete, nothing more to do — check this before
  // the terraformability check because the planet type may already have changed.
  if (existingProgress?.stage === 'complete') {
    return { planet, progress: existingProgress, event: undefined };
  }

  // Planet type must support terraforming.
  const targetType = getTerraformTarget(planet.type);
  if (targetType === undefined) {
    return { planet, progress: null, event: undefined };
  }

  // Initialise fresh progress if none exists.
  const progress: TerraformingProgress = existingProgress ?? {
    planetId: planet.id,
    systemId: '',  // caller should supply systemId; empty string is safe default
    stage:    'atmosphere',
    progress: 0,
    targetType,
  };

  // Clamp station level to at least 1.
  const level = Math.max(1, stationLevel);

  // Calculate points gained this tick.
  const rate = PROGRESS_PER_TICK[progress.stage];
  const gained = rate * level;
  const newProgressPoints = progress.progress + gained;

  // Has the stage completed?
  if (newProgressPoints >= STAGE_COST) {
    return completeStage(planet, progress, targetType);
  }

  // Stage still in progress.
  const updatedProgress: TerraformingProgress = {
    ...progress,
    progress: newProgressPoints,
    targetType,
  };

  return { planet, progress: updatedProgress, event: undefined };
}

// ---------------------------------------------------------------------------
// Internal stage completion logic
// ---------------------------------------------------------------------------

function completeStage(
  planet: Planet,
  progress: TerraformingProgress,
  targetType: PlanetType,
): TerraformingTickResult {
  const currentStageIndex = STAGE_ORDER.indexOf(progress.stage);
  const nextStage = STAGE_ORDER[currentStageIndex + 1] ?? 'complete';

  let updatedPlanet = planet;
  let event: string | undefined;

  switch (progress.stage) {
    case 'atmosphere': {
      updatedPlanet = { ...planet, atmosphere: TARGET_ATMOSPHERE };
      event = `Terraforming: atmosphere processing complete on ${planet.name} — atmosphere now oxygen-nitrogen`;
      break;
    }
    case 'temperature': {
      updatedPlanet = { ...planet, temperature: TARGET_TEMPERATURE };
      event = `Terraforming: thermal regulation complete on ${planet.name} — temperature normalised to ${TARGET_TEMPERATURE}K`;
      break;
    }
    case 'biosphere': {
      updatedPlanet = {
        ...planet,
        naturalResources: Math.min(100, planet.naturalResources + BIOSPHERE_RESOURCE_BONUS),
        maxPopulation:    planet.maxPopulation + BIOSPHERE_POPULATION_BONUS,
      };
      event = `Terraforming: biosphere engineering complete on ${planet.name} — resources and population capacity increased`;
      break;
    }
    case 'complete': {
      // Already complete — should not reach here.
      break;
    }
  }

  if (nextStage === 'complete') {
    // Final stage done — convert the planet type.
    updatedPlanet = { ...updatedPlanet, type: targetType };
    const updatedProgress: TerraformingProgress = {
      ...progress,
      stage:    'complete',
      progress: STAGE_COST,
      targetType,
    };
    return {
      planet:   updatedPlanet,
      progress: updatedProgress,
      event:    `Terraforming complete on ${planet.name} — planet converted to ${targetType}`,
    };
  }

  const updatedProgress: TerraformingProgress = {
    ...progress,
    stage:    nextStage,
    progress: 0,
    targetType,
  };

  return { planet: updatedPlanet, progress: updatedProgress, event };
}
