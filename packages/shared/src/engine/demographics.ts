/**
 * Demographics engine — pure functions for creating, ticking, and querying
 * population demographics on a planet.
 *
 * Population is not a single number. It is a living society with age groups,
 * vocational specialisations, faith leanings, and loyalty segments. Buildings
 * are useless without the right people to staff them: a research lab without
 * scientists produces nothing; a factory without workers sits idle.
 *
 * All functions are pure / side-effect-free. Callers must persist state.
 */

import type {
  AgeDistribution,
  FaithDistribution,
  LoyaltyDistribution,
  PlanetDemographics,
  VocationDistribution,
} from '../types/demographics.js';
import type { BuildingType } from '../types/galaxy.js';

// ---------------------------------------------------------------------------
// Modifiers passed into the tick function
// ---------------------------------------------------------------------------

/** External factors that influence demographic shifts each tick */
export interface DemographicModifiers {
  /** Base growth rate multiplier (species reproduction trait, government, etc.) */
  growthRate: number;
  /** Health infrastructure quality (0-100). Affects mortality and growth. */
  healthLevel: number;
  /** Education infrastructure quality (0-100). Affects vocation training. */
  educationLevel: number;
  /** Overall happiness score (-100 to 100). Affects loyalty and growth. */
  happiness: number;
  /** Government type influences faith drift and loyalty */
  isTheocracy: boolean;
  /** Available building types on the planet — drives vocation demand */
  availableBuildings: BuildingType[];
}

// ---------------------------------------------------------------------------
// Species-specific faith presets
// ---------------------------------------------------------------------------

/** Known species IDs that have specific faith leanings */
const DEVOUT_SPECIES = new Set([
  'orivani',
]);

const SECULAR_SPECIES = new Set([
  'kaelenth',
  'nexari',
]);

function getSpeciesFaithDistribution(speciesId: string): FaithDistribution {
  if (DEVOUT_SPECIES.has(speciesId)) {
    return { fanatics: 0.30, observant: 0.40, casual: 0.20, indifferent: 0.08, secular: 0.02 };
  }
  if (SECULAR_SPECIES.has(speciesId)) {
    return { fanatics: 0.01, observant: 0.04, casual: 0.10, indifferent: 0.25, secular: 0.60 };
  }
  // Default: moderately religious
  return { fanatics: 0.05, observant: 0.15, casual: 0.30, indifferent: 0.30, secular: 0.20 };
}

// ---------------------------------------------------------------------------
// Public: createInitialDemographics
// ---------------------------------------------------------------------------

/**
 * Create the initial demographic snapshot for a newly colonised planet.
 *
 * @param population  Starting total population.
 * @param speciesId   Species identifier — determines faith distribution.
 * @returns A fully populated PlanetDemographics snapshot.
 */
export function createInitialDemographics(
  population: number,
  speciesId: string,
): PlanetDemographics {
  const pop = Math.max(0, Math.round(population));

  // Age distribution: ~20% young, ~65% working, ~15% elderly
  const youngRatio = 0.20;
  const workingRatio = 0.65;
  const elderlyRatio = 0.15;

  const young = Math.round(pop * youngRatio);
  const elderly = Math.round(pop * elderlyRatio);
  const workingAge = pop - young - elderly;

  const age: AgeDistribution = { young, workingAge, elderly };

  // Vocation distribution: mostly general labour with small specialist pools
  const vocations = createInitialVocations(workingAge);

  // Faith based on species
  const faithRatios = getSpeciesFaithDistribution(speciesId);
  const faith = distributeFaith(pop, faithRatios);

  // Loyalty starts at content/loyal for home planets
  const loyalty: LoyaltyDistribution = {
    loyal: Math.round(pop * 0.35),
    content: Math.round(pop * 0.50),
    disgruntled: Math.round(pop * 0.12),
    rebellious: Math.round(pop * 0.03),
  };
  // Correct rounding errors
  correctLoyaltyDistribution(loyalty, pop);

  return {
    totalPopulation: pop,
    age,
    vocations,
    faith,
    loyalty,
    educationLevel: 50,
    healthLevel: 60,
    primarySpeciesId: speciesId,
  };
}

// ---------------------------------------------------------------------------
// Public: tickDemographics
// ---------------------------------------------------------------------------

/**
 * Advance demographics by one tick.
 *
 * This handles:
 * - Population growth/decline based on health, happiness, and growth rate
 * - Age progression (young -> working -> elderly, with mortality)
 * - Vocation shifts based on education level and available buildings
 * - Loyalty shifts based on happiness
 *
 * @param demographics  Current demographic snapshot.
 * @param modifiers     External factors influencing the tick.
 * @returns A new PlanetDemographics snapshot (does not mutate the input).
 */
export function tickDemographics(
  demographics: PlanetDemographics,
  modifiers: DemographicModifiers,
): PlanetDemographics {
  const d = demographics;
  if (d.totalPopulation <= 0) return { ...d };

  // --- 1. Growth / decline ---
  // Base growth is ~1% per tick, modified by health, happiness, and species traits
  const healthFactor = modifiers.healthLevel / 100;              // 0.0 - 1.0
  const happinessFactor = (modifiers.happiness + 100) / 200;     // 0.0 - 1.0
  const baseGrowthRate = 0.01 * modifiers.growthRate;
  const effectiveGrowth = baseGrowthRate * healthFactor * happinessFactor;

  // Mortality rate: inverse of health — worse health = more deaths
  const mortalityRate = 0.005 * (1 - healthFactor * 0.8);

  const births = Math.round(d.age.workingAge * effectiveGrowth);
  const elderlyDeaths = Math.round(d.age.elderly * mortalityRate * 2);  // Elderly die faster
  const otherDeaths = Math.round((d.age.young + d.age.workingAge) * mortalityRate * 0.3);

  // If happiness is very low, people refuse to procreate
  const effectiveBirths = modifiers.happiness < -50 ? Math.round(births * 0.2) : births;

  // --- 2. Age progression ---
  // Each tick, a fraction of each age group ages up
  const ageUpRate = 0.02;  // 2% of each group ages up per tick

  const youngToWorking = Math.round(d.age.young * ageUpRate);
  const workingToElderly = Math.round(d.age.workingAge * ageUpRate * 0.5); // Slower transition

  let newYoung = d.age.young + effectiveBirths - youngToWorking - Math.round(otherDeaths * 0.3);
  let newWorking = d.age.workingAge + youngToWorking - workingToElderly - Math.round(otherDeaths * 0.7);
  let newElderly = d.age.elderly + workingToElderly - elderlyDeaths;

  // Clamp to non-negative
  newYoung = Math.max(0, newYoung);
  newWorking = Math.max(0, newWorking);
  newElderly = Math.max(0, newElderly);

  const newTotal = newYoung + newWorking + newElderly;

  // --- 3. Vocation shifts ---
  const newVocations = tickVocations(d.vocations, newWorking, modifiers.educationLevel, modifiers.availableBuildings);

  // --- 4. Faith shifts ---
  const newFaith = tickFaith(d.faith, newTotal, modifiers.isTheocracy);

  // --- 5. Loyalty shifts ---
  const newLoyalty = tickLoyalty(d.loyalty, newTotal, modifiers.happiness);

  // --- 6. Update education and health levels ---
  const newEducation = Math.min(100, Math.max(0, modifiers.educationLevel));
  const newHealth = Math.min(100, Math.max(0, modifiers.healthLevel));

  return {
    totalPopulation: newTotal,
    age: { young: newYoung, workingAge: newWorking, elderly: newElderly },
    vocations: newVocations,
    faith: newFaith,
    loyalty: newLoyalty,
    educationLevel: newEducation,
    healthLevel: newHealth,
    primarySpeciesId: d.primarySpeciesId,
    secondarySpecies: d.secondarySpecies,
  };
}

// ---------------------------------------------------------------------------
// Public: calculateEffectiveWorkers
// ---------------------------------------------------------------------------

/** Building type to required vocation mapping */
const BUILDING_VOCATION_MAP: Record<string, keyof VocationDistribution> = {
  research_lab: 'scientists',
  factory: 'workers',
  shipyard: 'workers',         // Shipyards need workers (+ military for crewing)
  trade_hub: 'merchants',
  spaceport: 'merchants',
  mining_facility: 'workers',
  power_plant: 'workers',
  military_academy: 'military',
  defense_grid: 'military',
  population_center: 'general',
  entertainment_complex: 'general',
  hydroponics_bay: 'workers',
  communications_hub: 'administrators',
  medical_bay: 'medical',
  advanced_medical_centre: 'medical',
  fusion_reactor: 'workers',
  recycling_plant: 'workers',
  orbital_platform: 'workers',
  terraforming_station: 'scientists',
  // Unique buildings
  crystal_resonance_chamber: 'scientists',
  psionic_amplifier: 'scientists',
  war_forge: 'workers',
  magma_tap: 'workers',
  living_archive: 'scientists',
  growth_vat: 'medical',
  neural_network_hub: 'scientists',
};

/**
 * Calculate the effective workforce available for a given building type.
 *
 * A research lab is useless without scientists. A factory needs workers.
 * A shipyard needs both workers and military personnel. This function
 * returns the number of workers from the appropriate vocation pool.
 *
 * @param demographics  Current demographic snapshot.
 * @param buildingType  The type of building to staff.
 * @returns The number of appropriately skilled workers available.
 */
export function calculateEffectiveWorkers(
  demographics: PlanetDemographics,
  buildingType: string,
): number {
  const vocationKey = BUILDING_VOCATION_MAP[buildingType];

  if (!vocationKey) {
    // Unknown building type — fall back to general labour pool
    return demographics.vocations.general;
  }

  const primaryWorkers = demographics.vocations[vocationKey];

  // Shipyards also benefit from military personnel (they crew the ships)
  if (buildingType === 'shipyard') {
    return primaryWorkers + Math.round(demographics.vocations.military * 0.5);
  }

  return primaryWorkers;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Create initial vocation distribution — mostly general with small specialist pools */
function createInitialVocations(workingAge: number): VocationDistribution {
  const vocations: VocationDistribution = {
    scientists: Math.round(workingAge * 0.03),
    workers: Math.round(workingAge * 0.15),
    military: Math.round(workingAge * 0.05),
    merchants: Math.round(workingAge * 0.04),
    administrators: Math.round(workingAge * 0.03),
    educators: Math.round(workingAge * 0.02),
    medical: Math.round(workingAge * 0.02),
    general: 0,
  };
  // Remainder goes to general labour (~66%)
  const assigned = vocations.scientists + vocations.workers + vocations.military
    + vocations.merchants + vocations.administrators + vocations.educators + vocations.medical;
  vocations.general = Math.max(0, workingAge - assigned);
  return vocations;
}

/** Distribute faith across population segments according to ratios */
function distributeFaith(population: number, ratios: FaithDistribution): FaithDistribution {
  const faith: FaithDistribution = {
    fanatics: Math.round(population * ratios.fanatics),
    observant: Math.round(population * ratios.observant),
    casual: Math.round(population * ratios.casual),
    indifferent: Math.round(population * ratios.indifferent),
    secular: 0,
  };
  // Remainder goes to secular to avoid rounding errors
  const assigned = faith.fanatics + faith.observant + faith.casual + faith.indifferent;
  faith.secular = Math.max(0, population - assigned);
  return faith;
}

/** Correct rounding errors in a loyalty distribution so values sum to target */
function correctLoyaltyDistribution(dist: LoyaltyDistribution, target: number): void {
  const sum = dist.loyal + dist.content + dist.disgruntled + dist.rebellious;
  const diff = target - sum;
  if (diff !== 0) {
    // Adjust the largest segment to compensate
    const entries: [keyof LoyaltyDistribution, number][] = [
      ['loyal', dist.loyal], ['content', dist.content],
      ['disgruntled', dist.disgruntled], ['rebellious', dist.rebellious],
    ];
    const largest = entries.reduce((a, b) => (a[1] >= b[1] ? a : b));
    dist[largest[0]] = Math.max(0, dist[largest[0]] + diff);
  }
}

/** Tick vocation distribution based on education and building demand */
function tickVocations(
  current: VocationDistribution,
  newWorkingAge: number,
  educationLevel: number,
  availableBuildings: BuildingType[],
): VocationDistribution {
  // Calculate demand from buildings
  const demand = calculateVocationDemand(availableBuildings);

  // Training capacity: how many people can be trained per tick
  // Higher education = more specialists can be trained
  const trainingCapacity = Math.round(newWorkingAge * (educationLevel / 100) * 0.02);

  const result = { ...current };

  // Scale existing vocations to new working age
  const oldTotal = getTotalVocations(current);
  if (oldTotal > 0 && oldTotal !== newWorkingAge) {
    const scale = newWorkingAge / oldTotal;
    const vocationKeys: (keyof VocationDistribution)[] = [
      'scientists', 'workers', 'military', 'merchants',
      'administrators', 'educators', 'medical', 'general',
    ];
    for (const key of vocationKeys) {
      result[key] = Math.round(current[key] * scale);
    }
    // Correct rounding
    const newSum = getTotalVocations(result);
    result.general = Math.max(0, result.general + (newWorkingAge - newSum));
  }

  // Move general workers towards demanded vocations (limited by training capacity)
  let remainingCapacity = trainingCapacity;
  const trainableKeys: (keyof VocationDistribution)[] = [
    'scientists', 'workers', 'military', 'merchants',
    'administrators', 'educators', 'medical',
  ];

  for (const key of trainableKeys) {
    if (remainingCapacity <= 0) break;
    const demandForKey = demand[key] ?? 0;
    const deficit = Math.max(0, demandForKey - result[key]);
    if (deficit > 0 && result.general > 0) {
      const toTrain = Math.min(deficit, remainingCapacity, result.general);
      result[key] += toTrain;
      result.general -= toTrain;
      remainingCapacity -= toTrain;
    }
  }

  return result;
}

/** Calculate how many workers each vocation needs based on available buildings */
function calculateVocationDemand(buildings: BuildingType[]): Partial<Record<keyof VocationDistribution, number>> {
  const demand: Partial<Record<keyof VocationDistribution, number>> = {};
  const workersPerBuilding = 200; // Each building wants ~200 workers of its type

  for (const building of buildings) {
    const vocationKey = BUILDING_VOCATION_MAP[building];
    if (vocationKey) {
      demand[vocationKey] = (demand[vocationKey] ?? 0) + workersPerBuilding;
    }
  }

  return demand;
}

/** Sum all vocation values */
function getTotalVocations(v: VocationDistribution): number {
  return v.scientists + v.workers + v.military + v.merchants
    + v.administrators + v.educators + v.medical + v.general;
}

/** Tick faith distribution — theocracies shift towards devout, others drift towards secular */
function tickFaith(
  current: FaithDistribution,
  newTotal: number,
  isTheocracy: boolean,
): FaithDistribution {
  // Scale to new population
  const oldTotal = current.fanatics + current.observant + current.casual
    + current.indifferent + current.secular;

  if (oldTotal <= 0 || newTotal <= 0) {
    return { fanatics: 0, observant: 0, casual: 0, indifferent: 0, secular: 0 };
  }

  const scale = newTotal / oldTotal;
  const result: FaithDistribution = {
    fanatics: Math.round(current.fanatics * scale),
    observant: Math.round(current.observant * scale),
    casual: Math.round(current.casual * scale),
    indifferent: Math.round(current.indifferent * scale),
    secular: Math.round(current.secular * scale),
  };

  // Drift rate: small shifts each tick
  const driftRate = 0.005; // 0.5% per tick
  const driftAmount = Math.max(1, Math.round(newTotal * driftRate));

  if (isTheocracy) {
    // Theocracy: shift towards more devout
    // indifferent -> casual, casual -> observant, observant -> fanatics
    shiftFaith(result, 'indifferent', 'casual', driftAmount);
    shiftFaith(result, 'casual', 'observant', Math.round(driftAmount * 0.5));
    shiftFaith(result, 'secular', 'indifferent', driftAmount);
  } else {
    // Non-theocracy: slow secular drift
    shiftFaith(result, 'fanatics', 'observant', Math.round(driftAmount * 0.3));
    shiftFaith(result, 'observant', 'casual', Math.round(driftAmount * 0.2));
    shiftFaith(result, 'indifferent', 'secular', Math.round(driftAmount * 0.1));
  }

  // Correct rounding errors
  const faithKeys: (keyof FaithDistribution)[] = ['fanatics', 'observant', 'casual', 'indifferent', 'secular'];
  const faithSum = faithKeys.reduce((s, k) => s + result[k], 0);
  const diff = newTotal - faithSum;
  if (diff !== 0) {
    result.casual = Math.max(0, result.casual + diff);
  }

  return result;
}

/** Tick loyalty distribution based on happiness */
function tickLoyalty(
  current: LoyaltyDistribution,
  newTotal: number,
  happiness: number,
): LoyaltyDistribution {
  const oldTotal = current.loyal + current.content + current.disgruntled + current.rebellious;

  if (oldTotal <= 0 || newTotal <= 0) {
    return { loyal: 0, content: 0, disgruntled: 0, rebellious: 0 };
  }

  const scale = newTotal / oldTotal;
  const result: LoyaltyDistribution = {
    loyal: Math.round(current.loyal * scale),
    content: Math.round(current.content * scale),
    disgruntled: Math.round(current.disgruntled * scale),
    rebellious: Math.round(current.rebellious * scale),
  };

  // Shift based on happiness
  const driftRate = 0.01; // 1% per tick
  const driftAmount = Math.max(1, Math.round(newTotal * driftRate));

  if (happiness > 25) {
    // Happy population: shift towards loyal
    shiftLoyalty(result, 'rebellious', 'disgruntled', driftAmount);
    shiftLoyalty(result, 'disgruntled', 'content', driftAmount);
    shiftLoyalty(result, 'content', 'loyal', Math.round(driftAmount * 0.5));
  } else if (happiness < -25) {
    // Unhappy population: shift towards rebellious
    shiftLoyalty(result, 'loyal', 'content', driftAmount);
    shiftLoyalty(result, 'content', 'disgruntled', driftAmount);
    shiftLoyalty(result, 'disgruntled', 'rebellious', Math.round(driftAmount * 0.5));
  }
  // Between -25 and 25: population remains stable

  // Correct rounding errors
  const loyaltySum = result.loyal + result.content + result.disgruntled + result.rebellious;
  const diff = newTotal - loyaltySum;
  if (diff !== 0) {
    result.content = Math.max(0, result.content + diff);
  }

  return result;
}

/** Shift faith population from one segment to another */
function shiftFaith(
  dist: FaithDistribution,
  from: keyof FaithDistribution,
  to: keyof FaithDistribution,
  amount: number,
): void {
  const actual = Math.min(amount, dist[from]);
  dist[from] -= actual;
  dist[to] += actual;
}

/** Shift loyalty population from one segment to another */
function shiftLoyalty(
  dist: LoyaltyDistribution,
  from: keyof LoyaltyDistribution,
  to: keyof LoyaltyDistribution,
  amount: number,
): void {
  const actual = Math.min(amount, dist[from]);
  dist[from] -= actual;
  dist[to] += actual;
}
