/**
 * Corruption, wealth distribution, employment, and crime engine.
 *
 * Pure functions for calculating and advancing economic/social systems
 * that underpin a planet's stability. All functions are side-effect-free.
 *
 * Key design principles:
 * - Corruption is NOT pure entropy. Disciplined populations with good
 *   institutions resist it naturally.
 * - There is an "optimal corruption band": zero corruption implies a
 *   police state; a small amount provides flexibility, black market
 *   access for spy networks, and social lubrication.
 * - Inequality creates escalating probability of crisis (1%, 2%, 3%…).
 * - Employment is vocation-specific; skills gaps are a real problem.
 * - Crime emerges from economic conditions, not random chance.
 */

import type { GovernmentType } from '../types/government.js';
import type {
  CrimeState,
  EmploymentState,
  PlanetDemographics,
  VocationDistribution,
  WealthDistribution,
} from '../types/demographics.js';
import type { Building } from '../types/galaxy.js';
import type { Governor } from '../types/governor.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Planet-level corruption snapshot. */
export interface PlanetCorruptionState {
  /** Current corruption level (0–100). */
  level: number;
  /** How entrenched corruption is — harder to remove once established (0–100). */
  entrenchment: number;
  /** Whether this planet is in the "optimal band" of manageable corruption. */
  inOptimalBand: boolean;
}

/** Governor-level corruption snapshot. */
export interface GovernorCorruptionState {
  governorId: string;
  /** Personal corruption (0–100). */
  level: number;
  /** Whether the governor is actively skimming resources. */
  isSkimming: boolean;
}

/** Empire-wide corruption state, stored per empire. */
export interface EmpireCorruptionState {
  /** Corruption per planet (planetId → state). */
  planets: Record<string, PlanetCorruptionState>;
  /** Corruption per governor (governorId → state). */
  governors: Record<string, GovernorCorruptionState>;
  /** Empire-wide average corruption. */
  averageCorruption: number;
}

/** An event emitted by the corruption tick. */
export interface CorruptionEvent {
  type:
    | 'corruption_scandal'
    | 'anti_corruption_success'
    | 'corruption_entrenched'
    | 'governor_caught_skimming'
    | 'black_market_opportunity'
    | 'economic_crisis'
    | 'labour_strike'
    | 'wealth_redistribution';
  planetId?: string;
  governorId?: string;
  severity: number;
  message: string;
}

/** Result of an economic crisis check. */
export interface EconomicCrisisResult {
  /** Whether a crisis has occurred. */
  crisis: boolean;
  /** Type of crisis, if one occurred. */
  type?: 'recession' | 'depression' | 'hyperinflation' | 'debt_crisis' | 'social_collapse';
  /** Severity 0–100. */
  severity?: number;
}

/** Simple RNG interface for testability. */
export type Rng = () => number;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Baseline corruption tendency by government type (0–100 scale). */
const GOVERNMENT_CORRUPTION_BASELINE: Record<GovernmentType, number> = {
  democracy:       15,
  republic:        18,
  federation:      12,
  autocracy:       45,
  empire:          40,
  theocracy:       35,
  oligarchy:       55,
  military_junta:  60,
  technocracy:     10,
  hive_mind:        2,
  forced_labour:   65,
  dictatorship:    70,
  equality:         8,
  tribal_council:  20,
};

/**
 * The optimal corruption band — a small amount of corruption provides
 * flexibility and social lubrication. Below this band, society is
 * rigidly over-policed (happiness penalty). Above it, inefficiency grows.
 */
const OPTIMAL_CORRUPTION_MIN = 3;
const OPTIMAL_CORRUPTION_MAX = 12;

/** Corruption entrenchment rate per tick (fraction of current level). */
const ENTRENCHMENT_RATE = 0.002;

/** Maximum distance-from-capital factor. */
const MAX_DISTANCE_CORRUPTION = 15;

/** Maximum empire-size factor. */
const MAX_SIZE_CORRUPTION = 10;

/**
 * Vocation-to-building mapping: which building types create demand
 * for which vocation.
 */
const BUILDING_VOCATION_DEMAND: Record<string, { vocation: keyof VocationDistribution; jobs: number }> = {
  research_lab:              { vocation: 'scientists',      jobs: 500 },
  factory:                   { vocation: 'workers',         jobs: 800 },
  shipyard:                  { vocation: 'workers',         jobs: 600 },
  trade_hub:                 { vocation: 'merchants',       jobs: 400 },
  defense_grid:              { vocation: 'military',        jobs: 200 },
  population_center:         { vocation: 'general',         jobs: 300 },
  mining_facility:           { vocation: 'workers',         jobs: 700 },
  spaceport:                 { vocation: 'merchants',       jobs: 500 },
  power_plant:               { vocation: 'workers',         jobs: 400 },
  entertainment_complex:     { vocation: 'general',         jobs: 350 },
  hydroponics_bay:           { vocation: 'workers',         jobs: 300 },
  orbital_platform:          { vocation: 'workers',         jobs: 500 },
  recycling_plant:           { vocation: 'workers',         jobs: 250 },
  communications_hub:        { vocation: 'administrators',  jobs: 200 },
  terraforming_station:      { vocation: 'scientists',      jobs: 300 },
  military_academy:          { vocation: 'military',        jobs: 400 },
  fusion_reactor:            { vocation: 'scientists',      jobs: 250 },
  medical_bay:               { vocation: 'medical',         jobs: 400 },
  advanced_medical_centre:   { vocation: 'medical',         jobs: 600 },
  waste_dump:                { vocation: 'general',         jobs: 100 },
  waste_incinerator:         { vocation: 'workers',         jobs: 150 },
  atmosphere_cleanser:       { vocation: 'scientists',      jobs: 200 },
  orbital_waste_ejector:     { vocation: 'workers',         jobs: 200 },
  energy_storage:            { vocation: 'workers',         jobs: 100 },
  crystal_resonance_chamber: { vocation: 'scientists',      jobs: 300 },
  psionic_amplifier:         { vocation: 'scientists',      jobs: 200 },
  war_forge:                 { vocation: 'workers',         jobs: 800 },
  magma_tap:                 { vocation: 'workers',         jobs: 500 },
};

/** Buildings that count as law enforcement for corruption/crime calculations. */
const LAW_ENFORCEMENT_BUILDINGS = new Set([
  'defense_grid',
  'communications_hub',
  'military_academy',
]);

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Clamp a value between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Calculate the base corruption level for a single planet.
 *
 * Corruption is driven by:
 * - Government type baseline (oligarchies and dictatorships are more corrupt)
 * - Wealth inequality (large gap between elite and destitute)
 * - Law enforcement infrastructure (buildings that provide oversight)
 * - Distance from the capital (remote planets are harder to govern)
 * - Empire size (more planets = more bureaucratic overhead)
 * - Transparency — represented implicitly by government type and enforcement
 *
 * Disciplined populations with good institutions resist corruption naturally.
 *
 * @param planet           Minimal planet data needed for calculation.
 * @param demographics     Current demographic state of the planet.
 * @param governmentType   The empire's form of government.
 * @param distanceFromCapital  Distance in wormhole hops from the capital system.
 * @param empirePlanetCount    Total number of colonised planets in the empire.
 * @returns Corruption level (0–100).
 */
export function calculatePlanetCorruption(
  planet: { buildings: Building[] },
  demographics: PlanetDemographics,
  governmentType: GovernmentType,
  distanceFromCapital: number,
  empirePlanetCount: number,
): number {
  // 1. Government baseline
  const baseline = GOVERNMENT_CORRUPTION_BASELINE[governmentType] ?? 30;

  // 2. Inequality factor — wealth gap drives corruption
  const wealth = demographics.wealth ?? { wealthyElite: 0.05, middleClass: 0.40, workingClass: 0.40, destitute: 0.15 };
  const inequalityIndex = calculateInequalityIndex(wealth);
  // Inequality contributes up to 20 points of corruption
  const inequalityFactor = (inequalityIndex / 100) * 20;

  // 3. Law enforcement — buildings that provide oversight reduce corruption
  const enforcementCount = planet.buildings.filter(
    b => LAW_ENFORCEMENT_BUILDINGS.has(b.type),
  ).length;
  // Each enforcement building reduces corruption by 3, up to 15
  const enforcementReduction = Math.min(enforcementCount * 3, 15);

  // 4. Distance from capital — remote colonies are harder to govern
  const distanceFactor = Math.min(distanceFromCapital * 2, MAX_DISTANCE_CORRUPTION);

  // 5. Empire size — larger empires suffer more bureaucratic corruption
  const sizeFactor = Math.min(Math.floor(empirePlanetCount / 5) * 2, MAX_SIZE_CORRUPTION);

  // 6. Education factor — educated populations are harder to corrupt
  const educationReduction = (demographics.educationLevel / 100) * 8;

  // 7. Loyalty factor — loyal populations resist corruption
  const loyalFraction =
    (demographics.loyalty.loyal + demographics.loyalty.content) /
    Math.max(1, demographics.totalPopulation);
  const loyaltyReduction = loyalFraction * 5;

  const raw =
    baseline +
    inequalityFactor +
    distanceFactor +
    sizeFactor -
    enforcementReduction -
    educationReduction -
    loyaltyReduction;

  return clamp(Math.round(raw * 10) / 10, 0, 100);
}

/**
 * Calculate a governor's personal corruption level.
 *
 * Governors are somewhat more resistant to corruption than the general
 * populace (they have a reputation to maintain), but they are not immune.
 * A planet awash in corruption will eventually taint even a principled
 * governor.
 *
 * @param governor           The governor in question.
 * @param planetCorruption   Current corruption level of the planet they govern.
 * @param rng                Random number generator (0–1) for variability.
 * @returns Governor corruption level (0–100).
 */
export function calculateGovernorCorruption(
  governor: Governor,
  planetCorruption: number,
  rng: Rng,
): number {
  // Governors resist about 40% of the planet's corruption pressure
  const resistanceFactor = 0.6;
  const basePressure = planetCorruption * resistanceFactor;

  // Longer-serving governors accumulate more corruption (power corrupts)
  const tenureFactor = Math.min(governor.turnsServed / 200, 0.3) * 15;

  // Happiness-boosting governors tend to be more honest (popular mandate)
  const integrityBonus = Math.max(0, governor.modifiers.happiness) * 0.3;

  // Random personal variation — some governors are simply more principled
  const personalVariation = (rng() - 0.5) * 6;

  const raw = basePressure + tenureFactor - integrityBonus + personalVariation;
  return clamp(Math.round(raw * 10) / 10, 0, 100);
}

/**
 * Process one tick of empire-wide corruption, including drift,
 * entrenchment, and anti-corruption measures.
 *
 * @param empireCorruption  Current empire corruption state.
 * @param planets           Planet data keyed by ID.
 * @param governors         Governors keyed by their assigned planet ID.
 * @param tick              Current game tick (for event timestamps).
 * @param rng               Random number generator.
 * @returns Updated corruption state and any events produced.
 */
export function processCorruptionTick(
  empireCorruption: EmpireCorruptionState,
  planets: Record<string, { buildings: Building[]; demographics: PlanetDemographics; governmentType: GovernmentType; distanceFromCapital: number }>,
  governors: Record<string, Governor>,
  tick: number,
  rng: Rng,
): { corruption: EmpireCorruptionState; events: CorruptionEvent[] } {
  const events: CorruptionEvent[] = [];
  const updatedPlanets: Record<string, PlanetCorruptionState> = {};
  const updatedGovernors: Record<string, GovernorCorruptionState> = {};
  const planetCount = Object.keys(planets).length;

  for (const [planetId, planetData] of Object.entries(planets)) {
    const prev = empireCorruption.planets[planetId] ?? { level: 0, entrenchment: 0, inOptimalBand: false };

    // Calculate target corruption from current conditions
    const target = calculatePlanetCorruption(
      planetData,
      planetData.demographics,
      planetData.governmentType,
      planetData.distanceFromCapital,
      planetCount,
    );

    // Corruption drifts towards target, but entrenched corruption resists reduction
    const drift = (target - prev.level) * 0.05;
    const entrenchmentResistance = drift < 0 ? prev.entrenchment * 0.01 : 0;
    const newLevel = clamp(prev.level + drift + entrenchmentResistance, 0, 100);

    // Entrenchment grows over time when corruption is high
    const newEntrenchment = clamp(
      prev.entrenchment + (newLevel > 30 ? ENTRENCHMENT_RATE * newLevel : -0.1),
      0,
      100,
    );

    const inOptimalBand = newLevel >= OPTIMAL_CORRUPTION_MIN && newLevel <= OPTIMAL_CORRUPTION_MAX;

    updatedPlanets[planetId] = {
      level: Math.round(newLevel * 10) / 10,
      entrenchment: Math.round(newEntrenchment * 10) / 10,
      inOptimalBand,
    };

    // Event: corruption becomes entrenched
    if (newEntrenchment > 50 && prev.entrenchment <= 50) {
      events.push({
        type: 'corruption_entrenched',
        planetId,
        severity: Math.round(newEntrenchment),
        message: `Corruption on this planet has become deeply entrenched. Anti-corruption efforts will be significantly less effective.`,
      });
    }

    // Event: scandal (high corruption + random chance)
    if (newLevel > 40 && rng() < (newLevel / 100) * 0.05) {
      events.push({
        type: 'corruption_scandal',
        planetId,
        severity: Math.round(newLevel),
        message: `A corruption scandal has been uncovered, revealing systematic abuse of public funds.`,
      });
    }

    // Event: black market opportunity (moderate corruption enables spy network access)
    if (inOptimalBand && rng() < 0.02) {
      events.push({
        type: 'black_market_opportunity',
        planetId,
        severity: 10,
        message: `The planet's informal economy has created a useful black market channel for intelligence operations.`,
      });
    }

    // Process governor corruption
    const governor = governors[planetId];
    if (governor) {
      const prevGov = empireCorruption.governors[governor.id] ?? { governorId: governor.id, level: 0, isSkimming: false };
      const govLevel = calculateGovernorCorruption(governor, newLevel, rng);

      // Governor starts skimming when corruption exceeds 35
      const isSkimming = govLevel > 35;

      // Event: governor caught skimming
      if (isSkimming && !prevGov.isSkimming && rng() < 0.3) {
        events.push({
          type: 'governor_caught_skimming',
          planetId,
          governorId: governor.id,
          severity: Math.round(govLevel),
          message: `Governor ${governor.name} has been caught diverting public funds for personal use.`,
        });
      }

      updatedGovernors[governor.id] = {
        governorId: governor.id,
        level: Math.round(govLevel * 10) / 10,
        isSkimming,
      };
    }
  }

  // Calculate empire-wide average
  const planetLevels = Object.values(updatedPlanets).map(p => p.level);
  const averageCorruption =
    planetLevels.length > 0
      ? Math.round((planetLevels.reduce((a, b) => a + b, 0) / planetLevels.length) * 10) / 10
      : 0;

  // Event: anti-corruption success (low average)
  if (averageCorruption < 15 && empireCorruption.averageCorruption >= 15) {
    events.push({
      type: 'anti_corruption_success',
      severity: 0,
      message: `Empire-wide corruption has dropped to manageable levels. Institutional integrity is strong.`,
    });
  }

  return {
    corruption: {
      planets: updatedPlanets,
      governors: updatedGovernors,
      averageCorruption,
    },
    events,
  };
}

/**
 * Calculate wealth distribution shifts based on tax policy, economic
 * output, and government type.
 *
 * This models the long-term drift of wealth through society. Different
 * government types and tax policies create different equilibria.
 *
 * @param demographics     Current demographic snapshot.
 * @param taxPolicy        Tax rate (0.0–1.0). Higher taxes redistribute more.
 * @param economicOutput   Total economic output of the planet (credits/tick).
 * @param governmentType   The empire's form of government.
 * @returns Updated wealth distribution.
 */
export function processWealthDistribution(
  demographics: PlanetDemographics,
  taxPolicy: number,
  economicOutput: number,
  governmentType: GovernmentType,
): WealthDistribution {
  const current = demographics.wealth ?? {
    wealthyElite: 0.05,
    middleClass: 0.40,
    workingClass: 0.40,
    destitute: 0.15,
  };

  // Government type wealth tendencies
  const govWealthTendency: Record<string, { eliteBias: number; destituteRisk: number }> = {
    democracy:       { eliteBias: 0.0,   destituteRisk: -0.01 },
    republic:        { eliteBias: 0.005, destituteRisk: -0.005 },
    federation:      { eliteBias: 0.0,   destituteRisk: -0.01 },
    autocracy:       { eliteBias: 0.01,  destituteRisk: 0.005 },
    empire:          { eliteBias: 0.01,  destituteRisk: 0.005 },
    theocracy:       { eliteBias: 0.005, destituteRisk: -0.005 },
    oligarchy:       { eliteBias: 0.02,  destituteRisk: 0.01 },
    military_junta:  { eliteBias: 0.015, destituteRisk: 0.01 },
    technocracy:     { eliteBias: 0.005, destituteRisk: -0.005 },
    hive_mind:       { eliteBias: -0.02, destituteRisk: -0.02 },
    forced_labour:   { eliteBias: 0.03,  destituteRisk: 0.02 },
    dictatorship:    { eliteBias: 0.02,  destituteRisk: 0.015 },
    equality:        { eliteBias: -0.02, destituteRisk: -0.02 },
    tribal_council:  { eliteBias: -0.01, destituteRisk: -0.01 },
  };

  const tendency = govWealthTendency[governmentType] ?? { eliteBias: 0, destituteRisk: 0 };

  // Tax redistribution effect: higher taxes pull wealth from elite, reduce destitution
  const taxRedistribution = taxPolicy * 0.03;

  // Economic output effect: strong economy lifts everyone (reduces destitution)
  // Normalised: 1000 credits/tick = baseline
  const economyFactor = clamp((economicOutput / 1000) * 0.005, 0, 0.02);

  // Calculate shifts (per tick — very gradual)
  const eliteShift = tendency.eliteBias - taxRedistribution * 0.5;
  const destituteShift = tendency.destituteRisk - taxRedistribution * 0.3 - economyFactor;

  // Apply shifts
  let wealthyElite = current.wealthyElite + eliteShift * 0.01;
  let destitute = current.destitute + destituteShift * 0.01;

  // Bounds
  wealthyElite = clamp(wealthyElite, 0.01, 0.30);
  destitute = clamp(destitute, 0.01, 0.50);

  // Middle class and working class absorb the remainder
  const remainder = 1.0 - wealthyElite - destitute;
  // Middle class tends to be slightly larger in prosperous societies
  const middleClassRatio = 0.5 + economyFactor * 2;
  let middleClass = remainder * middleClassRatio;
  let workingClass = remainder * (1 - middleClassRatio);

  // Ensure minimum proportions
  middleClass = Math.max(middleClass, 0.05);
  workingClass = Math.max(workingClass, 0.05);

  // Normalise to sum to 1.0
  const total = wealthyElite + middleClass + workingClass + destitute;
  return {
    wealthyElite: Math.round((wealthyElite / total) * 1000) / 1000,
    middleClass: Math.round((middleClass / total) * 1000) / 1000,
    workingClass: Math.round((workingClass / total) * 1000) / 1000,
    destitute: Math.round((destitute / total) * 1000) / 1000,
  };
}

/**
 * Calculate employment state for a planet.
 *
 * Jobs are provided by buildings and are vocation-specific. A research lab
 * needs scientists; a factory needs workers. If the population lacks the
 * right vocational mix, skill gaps emerge — buildings sit partially staffed
 * even while unemployment exists elsewhere.
 *
 * @param demographics     Current demographic snapshot.
 * @param buildings        Buildings on the planet (each provides jobs).
 * @param automationLevel  Automation technology level (0.0–1.0). Reduces total jobs needed.
 * @returns Employment state snapshot.
 */
export function processEmployment(
  demographics: PlanetDemographics,
  buildings: Building[],
  automationLevel: number,
): EmploymentState {
  const automationReduction = clamp(automationLevel, 0, 1);

  // Tally job demand by vocation
  const jobDemand: Record<string, number> = {};
  let totalJobs = 0;

  for (const building of buildings) {
    const mapping = BUILDING_VOCATION_DEMAND[building.type];
    if (!mapping) continue;

    const jobs = Math.round(mapping.jobs * (1 - automationReduction * 0.4));
    jobDemand[mapping.vocation] = (jobDemand[mapping.vocation] ?? 0) + jobs;
    totalJobs += jobs;
  }

  // Match workers to jobs by vocation
  const vocations = demographics.vocations;
  const skillGaps: Record<string, number> = {};
  let filledJobs = 0;

  const vocationKeys: (keyof VocationDistribution)[] = [
    'scientists', 'workers', 'military', 'merchants',
    'administrators', 'educators', 'medical', 'general',
  ];

  for (const vocation of vocationKeys) {
    const demand = jobDemand[vocation] ?? 0;
    const supply = vocations[vocation];

    if (demand > supply) {
      // Skill gap: more jobs than qualified workers
      skillGaps[vocation] = demand - supply;
      filledJobs += supply;
    } else {
      filledJobs += demand;
    }
  }

  // General workers can fill overflow from any vocation (unskilled labour)
  const unfilledSpecialist = totalJobs - filledJobs;
  const availableGeneral = Math.max(0, vocations.general - (jobDemand['general'] ?? 0));
  const generalFilling = Math.min(unfilledSpecialist, availableGeneral);
  filledJobs += generalFilling;

  // Unemployment: working-age population not employed
  const workingAge = demographics.age.workingAge;
  const unemployed = Math.max(0, workingAge - filledJobs);
  const unemploymentRate = workingAge > 0 ? unemployed / workingAge : 0;

  // Labour shortage: more jobs than total working-age population
  const labourShortage = totalJobs > workingAge;

  return {
    totalJobs,
    filledJobs,
    unemploymentRate: Math.round(unemploymentRate * 1000) / 1000,
    labourShortage,
    skillGaps,
  };
}

/**
 * Calculate the crime state for a planet.
 *
 * Crime emerges from economic conditions:
 * - Unemployment drives petty crime and desperation
 * - Low happiness breeds resentment and antisocial behaviour
 * - Wealth inequality creates organised crime opportunities
 * - Corruption corrodes the institutions meant to prevent crime
 * - Trade routes provide vectors for smuggling and organised crime
 *
 * @param demographics       Current demographic snapshot.
 * @param employment         Current employment state.
 * @param wealth             Current wealth distribution.
 * @param corruption         Current planet corruption level (0–100).
 * @param lawEnforcement     Number of law enforcement buildings on the planet.
 * @returns Crime state snapshot.
 */
export function processCrime(
  demographics: PlanetDemographics,
  employment: EmploymentState,
  wealth: WealthDistribution,
  corruption: number,
  lawEnforcement: number,
): CrimeState {
  // Base crime from unemployment (strongest single driver)
  const unemploymentCrime = employment.unemploymentRate * 0.4;

  // Happiness effect: unhappy populations turn to crime
  const happinessProxy =
    (demographics.loyalty.disgruntled + demographics.loyalty.rebellious) /
    Math.max(1, demographics.totalPopulation);
  const unhappinessCrime = happinessProxy * 0.25;

  // Inequality drives organised crime
  const inequality = calculateInequalityIndex(wealth);
  const inequalityCrime = (inequality / 100) * 0.2;

  // Corruption corrodes law enforcement effectiveness
  const corruptionCrime = (corruption / 100) * 0.15;

  // Law enforcement effectiveness
  // Each building provides 0.12 effectiveness, up to 0.85 (perfection is impossible)
  const rawEnforcement = Math.min(lawEnforcement * 0.12, 0.85);
  // Corruption degrades enforcement
  const enforcementDegradation = (corruption / 100) * 0.3;
  const lawEnforcementEffectiveness = clamp(rawEnforcement - enforcementDegradation, 0.05, 0.95);

  // Total raw crime rate
  const rawCrime = unemploymentCrime + unhappinessCrime + inequalityCrime + corruptionCrime;

  // Law enforcement suppresses crime but cannot eliminate it entirely
  const suppressedCrime = rawCrime * (1 - lawEnforcementEffectiveness * 0.6);
  const crimeRate = clamp(suppressedCrime, 0, 1);

  // Organised crime: emerges from inequality and corruption, harder to suppress
  const rawOrganised = (inequality / 100) * 0.4 + (corruption / 100) * 0.3;
  const organisedCrimePresence = clamp(
    rawOrganised * (1 - lawEnforcementEffectiveness * 0.3),
    0,
    1,
  );

  // Black market: follows organised crime, scales with trade/corruption
  const blackMarketActivity = clamp(
    organisedCrimePresence * 0.6 + (corruption / 100) * 0.2,
    0,
    1,
  );

  return {
    crimeRate: Math.round(crimeRate * 1000) / 1000,
    organisedCrimePresence: Math.round(organisedCrimePresence * 1000) / 1000,
    blackMarketActivity: Math.round(blackMarketActivity * 1000) / 1000,
    lawEnforcementEffectiveness: Math.round(lawEnforcementEffectiveness * 1000) / 1000,
  };
}

/**
 * Calculate a Gini-coefficient-style inequality index from a wealth
 * distribution.
 *
 * Returns a value 0–100 where:
 * - 0 = perfect equality (everyone in the same wealth bracket)
 * - 100 = maximum inequality (all wealth in one bracket)
 *
 * The calculation uses the deviation of each class from an equal
 * distribution (0.25 each), weighted by how extreme the deviation is.
 *
 * @param wealth  Wealth distribution to evaluate.
 * @returns Inequality index (0–100).
 */
export function calculateInequalityIndex(wealth: WealthDistribution): number {
  const ideal = 0.25;
  const segments = [wealth.wealthyElite, wealth.middleClass, wealth.workingClass, wealth.destitute];

  // Sum of absolute deviations from equal distribution
  let deviation = 0;
  for (const segment of segments) {
    deviation += Math.abs(segment - ideal);
  }

  // Maximum possible deviation is 1.5 (all in one segment: 3 * 0.25 + 1 * 0.75)
  // Normalise to 0–100
  const raw = (deviation / 1.5) * 100;

  // Weight: heavy destitution is worse than heavy elite
  // A society with 40% destitute is more unequal than one with 40% elite
  const destituteWeight = wealth.destitute > 0.25 ? (wealth.destitute - 0.25) * 40 : 0;
  const eliteWeight = wealth.wealthyElite > 0.25 ? (wealth.wealthyElite - 0.25) * 20 : 0;

  return clamp(Math.round(raw + destituteWeight + eliteWeight), 0, 100);
}

/**
 * Returns a production multiplier reflecting the economic drag from corruption.
 *
 * Formula: `1 - (corruptionLevel * 0.003)`
 *
 * At 0% corruption the multiplier is 1.0 (no penalty).
 * At 10% corruption the multiplier is 0.97 (3% production loss).
 * At 50% corruption the multiplier is 0.85 (15% production loss).
 * At 100% corruption the multiplier is 0.70 (30% production loss).
 *
 * The curve is intentionally gentle: even deeply corrupt empires can still
 * function, but the cumulative drag becomes strategically meaningful over
 * many ticks.
 *
 * @param corruptionLevel  Empire-wide or planet-level corruption (0-100).
 * @returns Production multiplier in the range [0.70, 1.0].
 */
export function getCorruptionPenalty(corruptionLevel: number): number {
  const clamped = clamp(corruptionLevel, 0, 100);
  return 1 - (clamped * 0.003);
}

/**
 * Check whether current economic conditions trigger a crisis.
 *
 * Uses an escalating probability model: the worse conditions are, the
 * higher the per-tick probability. Roughly:
 * - Mild stress: ~1% per tick
 * - Moderate stress: ~2–3% per tick
 * - Severe stress: ~5%+ per tick
 *
 * @param inequality    Inequality index (0–100).
 * @param unemployment  Unemployment rate (0.0–1.0).
 * @param corruption    Corruption level (0–100).
 * @param rng           Random number generator.
 * @returns Whether a crisis occurred, and its type/severity if so.
 */
export function checkEconomicCrisis(
  inequality: number,
  unemployment: number,
  corruption: number,
  rng: Rng,
): EconomicCrisisResult {
  // Calculate stress level (0–100)
  const stress =
    (inequality / 100) * 35 +
    unemployment * 40 +
    (corruption / 100) * 25;

  // Escalating probability: each 10 points of stress adds ~1% crisis chance
  const crisisProbability = Math.floor(stress / 10) * 0.01;

  if (rng() >= crisisProbability) {
    return { crisis: false };
  }

  // Determine crisis type based on the dominant stressor
  let type: EconomicCrisisResult['type'];
  if (unemployment > 0.3 && unemployment * 40 >= inequality * 0.35) {
    type = stress > 60 ? 'depression' : 'recession';
  } else if (corruption > 60 && corruption * 0.25 >= inequality * 0.35) {
    type = 'debt_crisis';
  } else if (inequality > 70) {
    type = 'social_collapse';
  } else {
    type = 'hyperinflation';
  }

  // Severity scales with stress
  const severity = clamp(Math.round(stress), 10, 100);

  return { crisis: true, type, severity };
}
