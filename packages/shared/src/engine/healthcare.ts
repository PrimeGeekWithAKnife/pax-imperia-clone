/**
 * Healthcare and disease engine — pure functions for medical infrastructure,
 * disease generation, pandemic spread, and population health management.
 *
 * All functions are side-effect free. Callers must apply the returned state
 * and events to their own game state records.
 *
 * Design goals:
 *  - Diseases are species-specific, with rare cross-species jumps for similar biology
 *  - Nanite and engineered diseases bypass species barriers
 *  - Healthcare policy operates on a spectrum: free → semi-subsidised → expensive → non-existent
 *  - Good healthcare = grateful population (Maslow lever)
 *  - Overcrowding increases disease risk
 *  - Pandemics spread along trade routes — quarantine (closing routes) prevents spread
 *  - Biological, chemical, and nuclear are distinct WMD categories
 */

import type { Building, BuildingType, Planet } from '../types/galaxy.js';
import type { PlanetDemographics } from '../types/demographics.js';
import type { SpecialAbility } from '../types/species.js';
import type { TradeRoute } from '../types/trade-routes.js';
import { generateId } from '../utils/id.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Biological classification that determines disease cross-species compatibility. */
export type BiologyType =
  | 'carbon_organic'      // Standard carbon-based life (most species)
  | 'silicon'             // Silicon-based biology (Khazari)
  | 'aquatic_organic'     // Water-dependent carbon life
  | 'cybernetic'          // Partly organic, partly machine
  | 'photosynthetic'      // Plant-like biology
  | 'energy_form'         // Non-corporeal — immune to biological disease
  | 'synthetic'           // Fully artificial — immune to biological disease
  | 'hive_organic';       // Organic but with shared neural architecture

/** Origin of a disease — natural diseases are species-bound; engineered ones are not. */
export type DiseaseOrigin = 'natural' | 'engineered' | 'nanite';

/** Current progression status of a disease on a planet. */
export type DiseaseStatus = 'active' | 'contained' | 'eradicated';

/** A disease outbreak on a planet or spreading through the galaxy. */
export interface Disease {
  id: string;
  /** Human-readable name of the disease. */
  name: string;
  /** Species that originally spawned or was targeted by this disease. */
  speciesOrigin: string;
  /** Biology types this disease can infect. */
  affectedBiologies: BiologyType[];
  /** Severity rating (1–10). Higher = more deadly and harder to treat. */
  severity: number;
  /** Base probability per tick that the disease jumps to a connected planet (0–1). */
  spreadRate: number;
  /** Fraction of infected population that dies per tick (0–1). */
  mortalityRate: number;
  /** Ticks before symptoms manifest and the disease becomes detectable. */
  incubationTicks: number;
  /** Number of population currently infected on the planet where this instance lives. */
  currentInfected: number;
  /** Current status of this disease instance. */
  status: DiseaseStatus;
  /** How the disease originated. Engineered and nanite diseases ignore biology barriers. */
  origin: DiseaseOrigin;
  /** Tick on which this disease was first detected. */
  detectedOnTick: number;
  /** ID of the planet where this disease instance is active. */
  planetId: string;
}

/** Healthcare policy spectrum — affects quality, cost, and population satisfaction. */
export type HealthcarePolicy = 'free' | 'semi_subsidised' | 'expensive' | 'none';

/** WMD categories for biological warfare. */
export type WmdCategory = 'biological' | 'chemical' | 'nuclear';

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface DiseaseOutbreakEvent {
  type: 'disease_outbreak';
  diseaseId: string;
  diseaseName: string;
  planetId: string;
  severity: number;
  initialInfected: number;
}

export interface DiseaseSpreadEvent {
  type: 'disease_spread';
  diseaseId: string;
  diseaseName: string;
  sourcePlanetId: string;
  targetPlanetId: string;
  tradeRouteId: string;
}

export interface DiseaseContainedEvent {
  type: 'disease_contained';
  diseaseId: string;
  diseaseName: string;
  planetId: string;
}

export interface DiseaseEradicatedEvent {
  type: 'disease_eradicated';
  diseaseId: string;
  diseaseName: string;
  planetId: string;
}

export interface PandemicTriggeredEvent {
  type: 'pandemic_triggered';
  planetId: string;
  healthLevel: number;
  population: number;
}

export interface PopulationLossEvent {
  type: 'population_loss';
  diseaseId: string;
  diseaseName: string;
  planetId: string;
  deaths: number;
}

export interface CrossSpeciesJumpEvent {
  type: 'cross_species_jump';
  diseaseId: string;
  diseaseName: string;
  originalBiology: BiologyType;
  newBiology: BiologyType;
  planetId: string;
}

export type HealthcareEvent =
  | DiseaseOutbreakEvent
  | DiseaseSpreadEvent
  | DiseaseContainedEvent
  | DiseaseEradicatedEvent
  | PandemicTriggeredEvent
  | PopulationLossEvent
  | CrossSpeciesJumpEvent;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Medical building types and the health floor each provides. */
const MEDICAL_BUILDING_HEALTH: Partial<Record<BuildingType, number>> = {
  medical_bay: 15,
  advanced_medical_centre: 30,
};

/** Healthcare policy quality multipliers (applied to health calculation). */
const POLICY_QUALITY: Record<HealthcarePolicy, number> = {
  free: 1.0,
  semi_subsidised: 0.75,
  expensive: 0.50,
  none: 0.10,
};

/** Healthcare policy satisfaction bonus to happiness / loyalty. */
export const POLICY_SATISFACTION: Record<HealthcarePolicy, number> = {
  free: 15,
  semi_subsidised: 5,
  expensive: -5,
  none: -20,
};

/** Overcrowding threshold — population / maxPopulation ratio above which disease risk rises. */
const OVERCROWDING_THRESHOLD = 0.80;

/** Base per-tick probability of a spontaneous disease outbreak (before modifiers). */
const BASE_OUTBREAK_CHANCE = 0.005;

/** Population threshold below which pandemics cannot trigger. */
const PANDEMIC_POPULATION_THRESHOLD = 50_000;

/** Health level below which pandemics can trigger. */
const PANDEMIC_HEALTH_THRESHOLD = 30;

/** Base probability per tick of a cross-species jump for biologically similar species. */
const CROSS_SPECIES_JUMP_BASE_CHANCE = 0.02;

/** Minimum infected fraction (of total population) required before a disease can spread off-world. */
const SPREAD_INFECTED_THRESHOLD = 0.01;

/** Maximum health level (hard cap). */
const HEALTH_MAX = 100;

// ---------------------------------------------------------------------------
// Biology compatibility
// ---------------------------------------------------------------------------

/**
 * Biology types that are similar enough for cross-species disease transmission.
 * If two biologies appear in the same group, a disease can (rarely) jump between them.
 */
const BIOLOGY_SIMILARITY_GROUPS: BiologyType[][] = [
  ['carbon_organic', 'aquatic_organic', 'hive_organic'],
  ['cybernetic', 'hive_organic'],
];

/**
 * Map a species' special abilities to a primary biology type.
 *
 * @param abilities - The species' special ability list.
 * @returns The inferred biology type.
 */
export function inferBiology(abilities: SpecialAbility[]): BiologyType {
  if (abilities.includes('energy_form') || abilities.includes('dimensional')) return 'energy_form';
  if (abilities.includes('synthetic') || abilities.includes('nanomorphic')) return 'synthetic';
  if (abilities.includes('silicon_based')) return 'silicon';
  if (abilities.includes('cybernetic')) return 'cybernetic';
  if (abilities.includes('aquatic')) return 'aquatic_organic';
  if (abilities.includes('photosynthetic')) return 'photosynthetic';
  if (abilities.includes('hive_mind')) return 'hive_organic';
  return 'carbon_organic';
}

/**
 * Determine whether two biology types are similar enough for cross-species disease jumps.
 *
 * @param a - First biology type.
 * @param b - Second biology type.
 * @returns `true` if the two biologies share a similarity group.
 */
export function areBiologicallySimilar(a: BiologyType, b: BiologyType): boolean {
  if (a === b) return true;
  return BIOLOGY_SIMILARITY_GROUPS.some(
    (group) => group.includes(a) && group.includes(b),
  );
}

// ---------------------------------------------------------------------------
// Disease name generation
// ---------------------------------------------------------------------------

const DISEASE_PREFIXES = [
  'Crimson', 'Shadow', 'Grey', 'Pale', 'Void', 'Stellar', 'Iron',
  'Crystal', 'Burning', 'Silent', 'Hollow', 'Deep', 'Wasting', 'Creeping',
];

const DISEASE_SUFFIXES = [
  'Plague', 'Blight', 'Fever', 'Rot', 'Pox', 'Wilt', 'Canker',
  'Scourge', 'Tremor', 'Chill', 'Flux', 'Wane', 'Decay', 'Miasma',
];

function generateDiseaseName(rng: () => number): string {
  const prefix = DISEASE_PREFIXES[Math.floor(rng() * DISEASE_PREFIXES.length)];
  const suffix = DISEASE_SUFFIXES[Math.floor(rng() * DISEASE_SUFFIXES.length)];
  return `${prefix} ${suffix}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Count functional medical buildings on a planet, weighted by level and condition.
 */
function medicalCapacity(buildings: Building[]): number {
  let total = 0;
  for (const b of buildings) {
    const baseHealth = MEDICAL_BUILDING_HEALTH[b.type];
    if (baseHealth === undefined) continue;
    const condition = (b.condition ?? 100) / 100;
    total += baseHealth * b.level * condition;
  }
  return total;
}

/**
 * Calculate the overcrowding factor for a planet.
 * Returns a value >= 1.0; higher means more overcrowded.
 */
function overcrowdingFactor(population: number, maxPopulation: number): number {
  if (maxPopulation <= 0) return 1.0;
  const ratio = population / maxPopulation;
  if (ratio <= OVERCROWDING_THRESHOLD) return 1.0;
  // Linear ramp: at 100% capacity → 2.0, at 120% → 3.0
  return 1.0 + (ratio - OVERCROWDING_THRESHOLD) / (1 - OVERCROWDING_THRESHOLD);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Public: processHealthcareTick
// ---------------------------------------------------------------------------

/**
 * Process one game tick of healthcare for a planet.
 *
 * Medical buildings provide a baseline health floor. Healthcare policy scales
 * the effective quality. Overcrowding degrades health and increases the
 * probability of spontaneous disease outbreaks.
 *
 * @param planet       - The planet to process.
 * @param demographics - Current demographic snapshot of the planet.
 * @param buildings    - Buildings present on the planet.
 * @param policy       - The empire's current healthcare policy.
 * @param tick         - Current game tick number.
 * @param rng          - Seeded random number generator (0–1).
 * @returns Updated health level and any events generated.
 */
export function processHealthcareTick(
  planet: Planet,
  demographics: PlanetDemographics,
  buildings: Building[],
  policy: HealthcarePolicy,
  tick: number,
  rng: () => number = Math.random,
): { health: number; events: HealthcareEvent[] } {
  const events: HealthcareEvent[] = [];

  // ── Step 1: Compute base health from medical infrastructure ─────────────
  const medCap = medicalCapacity(buildings);
  const policyMultiplier = POLICY_QUALITY[policy];

  // Medical capacity provides a health floor; policy scales effectiveness.
  // A planet with no medical buildings and no policy gets a bare minimum of 10.
  const baseHealth = Math.max(10, medCap * policyMultiplier);

  // ── Step 2: Apply overcrowding penalty ──────────────────────────────────
  const crowding = overcrowdingFactor(demographics.totalPopulation, planet.maxPopulation);
  const crowdingPenalty = (crowding - 1.0) * 25; // Each 1.0 of overcrowding = -25 health

  // ── Step 3: Medical staff bonus ─────────────────────────────────────────
  // Having dedicated medical vocation staff improves healthcare quality.
  const medicalStaffRatio = demographics.vocations.medical /
    Math.max(1, demographics.age.workingAge);
  const staffBonus = Math.min(10, medicalStaffRatio * 500); // Up to +10 from good staffing

  // ── Step 4: Blend towards target health ─────────────────────────────────
  const targetHealth = clamp(baseHealth + staffBonus - crowdingPenalty, 0, HEALTH_MAX);

  // Health drifts towards the target by up to 5 points per tick (no instant jumps).
  const currentHealth = demographics.healthLevel;
  const drift = clamp(targetHealth - currentHealth, -5, 5);
  const newHealth = clamp(currentHealth + drift, 0, HEALTH_MAX);

  // ── Step 5: Check for spontaneous outbreak ──────────────────────────────
  if (demographics.totalPopulation > 0) {
    const outbreakChance = BASE_OUTBREAK_CHANCE * crowding *
      (1 - newHealth / HEALTH_MAX); // Lower health → higher risk
    if (rng() < outbreakChance) {
      events.push({
        type: 'pandemic_triggered',
        planetId: planet.id,
        healthLevel: newHealth,
        population: demographics.totalPopulation,
      });
    }
  }

  return { health: Math.round(newHealth), events };
}

// ---------------------------------------------------------------------------
// Public: generateDisease
// ---------------------------------------------------------------------------

/**
 * Generate a new disease targeting a specific species biology.
 *
 * Natural diseases affect only the origin biology (and biologically similar
 * species via rare cross-species jumps). Engineered and nanite diseases
 * bypass biology barriers entirely.
 *
 * @param speciesId - ID of the species that spawned the disease.
 * @param biology   - Biology type of the origin species.
 * @param severity  - Severity rating (1–10).
 * @param rng       - Seeded random number generator (0–1).
 * @param origin    - How the disease originated (default: 'natural').
 * @param planetId  - ID of the planet where the disease appears.
 * @param tick      - Current game tick for detection timestamp.
 * @returns A fully initialised Disease instance.
 */
export function generateDisease(
  speciesId: string,
  biology: BiologyType,
  severity: number,
  rng: () => number = Math.random,
  origin: DiseaseOrigin = 'natural',
  planetId: string = '',
  tick: number = 0,
): Disease {
  const clampedSeverity = clamp(Math.round(severity), 1, 10);

  // Determine which biologies this disease can infect.
  let affectedBiologies: BiologyType[];
  if (origin === 'nanite' || origin === 'engineered') {
    // Engineered and nanite diseases affect all corporeal biologies.
    affectedBiologies = [
      'carbon_organic', 'silicon', 'aquatic_organic', 'cybernetic',
      'photosynthetic', 'hive_organic',
    ];
    // Nanite diseases can even affect synthetics.
    if (origin === 'nanite') {
      affectedBiologies.push('synthetic');
    }
  } else {
    // Natural diseases: only the origin biology.
    affectedBiologies = [biology];
  }

  // Scale spread and mortality from severity.
  const spreadRate = 0.05 + (clampedSeverity / 10) * 0.25;   // 0.05–0.30
  const mortalityRate = 0.001 + (clampedSeverity / 10) * 0.04; // 0.001–0.041
  const incubationTicks = Math.max(1, 6 - Math.floor(clampedSeverity / 2)); // 1–5 ticks

  return {
    id: generateId(),
    name: generateDiseaseName(rng),
    speciesOrigin: speciesId,
    affectedBiologies,
    severity: clampedSeverity,
    spreadRate,
    mortalityRate,
    incubationTicks,
    currentInfected: 0,
    status: 'active',
    origin,
    detectedOnTick: tick,
    planetId,
  };
}

// ---------------------------------------------------------------------------
// Public: spreadDisease
// ---------------------------------------------------------------------------

/** Minimal planet info needed for spread calculations. */
export interface SpreadPlanetInfo {
  id: string;
  systemId: string;
  population: number;
  primaryBiology: BiologyType;
  /** Whether this planet has imposed quarantine (closed trade routes). */
  quarantined: boolean;
  /** Existing disease IDs on this planet (to prevent duplicate infections). */
  existingDiseaseIds: string[];
}

/**
 * Attempt to spread a disease along trade routes to connected planets.
 *
 * Diseases only spread when:
 *  - The source planet has enough infected population (> 1% of total).
 *  - A trade route connects the source system to another system.
 *  - The destination planet is not quarantined.
 *  - The destination biology is compatible (or the disease is engineered/nanite).
 *
 * Cross-species jumps can occur when biologically similar species share a
 * planet connected by trade, but at very low probability.
 *
 * @param disease     - The disease to attempt spreading.
 * @param planets     - All planets with spread-relevant data.
 * @param tradeRoutes - Active trade routes in the galaxy.
 * @param tick        - Current game tick.
 * @param rng         - Seeded random number generator (0–1).
 * @returns New disease instances on infected planets and events.
 */
export function spreadDisease(
  disease: Disease,
  planets: SpreadPlanetInfo[],
  tradeRoutes: TradeRoute[],
  tick: number,
  rng: () => number = Math.random,
): { infectedPlanets: Disease[]; events: HealthcareEvent[] } {
  const infectedPlanets: Disease[] = [];
  const events: HealthcareEvent[] = [];

  // Disease must be active and have meaningful infected population.
  if (disease.status !== 'active') return { infectedPlanets, events };

  const sourcePlanet = planets.find((p) => p.id === disease.planetId);
  if (!sourcePlanet) return { infectedPlanets, events };

  const infectedFraction = sourcePlanet.population > 0
    ? disease.currentInfected / sourcePlanet.population
    : 0;
  if (infectedFraction < SPREAD_INFECTED_THRESHOLD) return { infectedPlanets, events };

  // Find active trade routes connected to the source system.
  const activeRoutes = tradeRoutes.filter(
    (r) =>
      r.status === 'active' &&
      r.path.includes(sourcePlanet.systemId),
  );

  for (const route of activeRoutes) {
    // Find candidate destination planets in systems along this route.
    const connectedSystemIds = route.path.filter((sid) => sid !== sourcePlanet.systemId);
    const candidatePlanets = planets.filter(
      (p) =>
        connectedSystemIds.includes(p.systemId) &&
        p.population > 0 &&
        !p.quarantined &&
        !p.existingDiseaseIds.includes(disease.id),
    );

    for (const target of candidatePlanets) {
      // Check biology compatibility.
      const directMatch = disease.affectedBiologies.includes(target.primaryBiology);
      const crossSpeciesMatch = !directMatch &&
        disease.origin === 'natural' &&
        disease.affectedBiologies.some((b) => areBiologicallySimilar(b, target.primaryBiology));

      let spreadChance = disease.spreadRate * infectedFraction;

      if (crossSpeciesMatch) {
        // Cross-species jumps are rare.
        spreadChance *= CROSS_SPECIES_JUMP_BASE_CHANCE;
      } else if (!directMatch) {
        // Incompatible biology — no spread.
        continue;
      }

      if (rng() < spreadChance) {
        const newDisease: Disease = {
          ...disease,
          id: generateId(),
          currentInfected: Math.max(1, Math.floor(target.population * 0.001)),
          planetId: target.id,
          detectedOnTick: tick,
          status: 'active',
        };

        // If this was a cross-species jump, add the new biology.
        if (crossSpeciesMatch && !newDisease.affectedBiologies.includes(target.primaryBiology)) {
          newDisease.affectedBiologies = [...newDisease.affectedBiologies, target.primaryBiology];
          events.push({
            type: 'cross_species_jump',
            diseaseId: newDisease.id,
            diseaseName: disease.name,
            originalBiology: disease.affectedBiologies[0],
            newBiology: target.primaryBiology,
            planetId: target.id,
          });
        }

        infectedPlanets.push(newDisease);
        events.push({
          type: 'disease_spread',
          diseaseId: newDisease.id,
          diseaseName: disease.name,
          sourcePlanetId: disease.planetId,
          targetPlanetId: target.id,
          tradeRouteId: route.id,
        });
      }
    }
  }

  return { infectedPlanets, events };
}

// ---------------------------------------------------------------------------
// Public: processDiseaseTick
// ---------------------------------------------------------------------------

/**
 * Process one game tick of a disease on a specific planet.
 *
 * - Disease grows infected count based on severity (modulated by healthcare).
 * - Healthcare buildings and policy fight the disease, reducing infections.
 * - Severe pandemics kill population proportional to mortality rate.
 * - When infections drop to zero, the disease is eradicated.
 *
 * @param disease      - The disease instance to process.
 * @param planet       - The planet where the disease is active.
 * @param demographics - Current demographic snapshot.
 * @param healthcare   - Healthcare quality (0–100, from processHealthcareTick).
 * @param rng          - Seeded random number generator (0–1).
 * @returns Updated disease, demographic adjustments, and events.
 */
export function processDiseaseTick(
  disease: Disease,
  planet: Planet,
  demographics: PlanetDemographics,
  healthcare: number,
  rng: () => number = Math.random,
): { disease: Disease; demographics: DemographicAdjustments; events: HealthcareEvent[] } {
  const events: HealthcareEvent[] = [];
  const updated = { ...disease };
  const adjustments: DemographicAdjustments = {
    populationDelta: 0,
    healthDelta: 0,
    productivityMultiplier: 1.0,
    growthMultiplier: 1.0,
  };

  // Already resolved diseases produce no further effects.
  if (disease.status === 'contained' || disease.status === 'eradicated') {
    return { disease: updated, demographics: adjustments, events };
  }

  const pop = demographics.totalPopulation;
  if (pop <= 0) {
    updated.status = 'eradicated';
    return { disease: updated, demographics: adjustments, events };
  }

  // ── Infection growth ────────────────────────────────────────────────────
  // Base growth rate scales with severity; healthcare quality opposes it.
  const healthcareFactor = clamp(healthcare / HEALTH_MAX, 0, 1);
  const growthRate = (disease.severity / 10) * 0.15 * (1 - healthcareFactor * 0.8);
  const newInfections = Math.floor(disease.currentInfected * growthRate);
  const maxInfectable = pop - disease.currentInfected;
  updated.currentInfected = Math.min(
    pop,
    disease.currentInfected + Math.min(newInfections, maxInfectable),
  );

  // ── Healthcare recovery ─────────────────────────────────────────────────
  // Medical infrastructure cures a fraction of the infected each tick.
  const recoveryRate = healthcareFactor * 0.10 + 0.01; // 1%–11% per tick
  const recovered = Math.floor(updated.currentInfected * recoveryRate);
  updated.currentInfected = Math.max(0, updated.currentInfected - recovered);

  // ── Mortality ───────────────────────────────────────────────────────────
  // Deaths occur among the infected, scaled by mortality rate and inversely by healthcare.
  const effectiveMortality = disease.mortalityRate * (1 - healthcareFactor * 0.7);
  const deaths = Math.floor(updated.currentInfected * effectiveMortality);
  if (deaths > 0) {
    adjustments.populationDelta = -deaths;
    updated.currentInfected = Math.max(0, updated.currentInfected - deaths);
    events.push({
      type: 'population_loss',
      diseaseId: disease.id,
      diseaseName: disease.name,
      planetId: planet.id,
      deaths,
    });
  }

  // ── Productivity and growth penalties ───────────────────────────────────
  const infectedRatio = pop > 0 ? updated.currentInfected / pop : 0;
  adjustments.productivityMultiplier = 1.0 - infectedRatio * 0.5; // Up to -50%
  adjustments.growthMultiplier = 1.0 - infectedRatio * 0.8;       // Up to -80%

  // Disease drags down planet health level.
  adjustments.healthDelta = -Math.round(infectedRatio * 20);

  // ── Status transitions ──────────────────────────────────────────────────
  if (updated.currentInfected <= 0) {
    updated.status = 'eradicated';
    updated.currentInfected = 0;
    events.push({
      type: 'disease_eradicated',
      diseaseId: disease.id,
      diseaseName: disease.name,
      planetId: planet.id,
    });
  } else if (infectedRatio < 0.01 && healthcare >= 50) {
    // Below 1% infection with decent healthcare → contained.
    updated.status = 'contained';
    events.push({
      type: 'disease_contained',
      diseaseId: disease.id,
      diseaseName: disease.name,
      planetId: planet.id,
    });
  }

  return { disease: updated, demographics: adjustments, events };
}

/** Adjustments to demographics produced by disease processing. */
export interface DemographicAdjustments {
  /** Population change this tick (negative for deaths). */
  populationDelta: number;
  /** Health level change this tick (negative during outbreaks). */
  healthDelta: number;
  /** Multiplier on worker productivity (0.5–1.0 during disease). */
  productivityMultiplier: number;
  /** Multiplier on population growth rate (0.2–1.0 during disease). */
  growthMultiplier: number;
}

// ---------------------------------------------------------------------------
// Public: checkPandemicTrigger
// ---------------------------------------------------------------------------

/**
 * Check whether conditions on a planet are ripe for a pandemic outbreak.
 *
 * Pandemics trigger when:
 *  - Health level is below 30.
 *  - Population exceeds 50,000.
 *  - Overcrowding increases the probability.
 *
 * @param planet       - The planet to evaluate.
 * @param demographics - Current demographic snapshot.
 * @param rng          - Seeded random number generator (0–1).
 * @returns `true` if a pandemic should be triggered this tick.
 */
export function checkPandemicTrigger(
  planet: Planet,
  demographics: PlanetDemographics,
  rng: () => number = Math.random,
): boolean {
  if (demographics.healthLevel >= PANDEMIC_HEALTH_THRESHOLD) return false;
  if (demographics.totalPopulation < PANDEMIC_POPULATION_THRESHOLD) return false;

  // Base probability: inverse of health level (lower health → higher chance).
  const healthFactor = 1 - demographics.healthLevel / PANDEMIC_HEALTH_THRESHOLD; // 0–1
  const crowding = overcrowdingFactor(demographics.totalPopulation, planet.maxPopulation);

  // Base chance of ~5% per tick at worst health, scaled by overcrowding.
  const chance = 0.05 * healthFactor * crowding;
  return rng() < chance;
}

// ---------------------------------------------------------------------------
// Public: createOutbreak
// ---------------------------------------------------------------------------

/**
 * Create an initial disease outbreak on a planet. This is a convenience
 * function that combines disease generation with initial infection seeding.
 *
 * @param speciesId - ID of the affected species.
 * @param biology   - Biology type of the affected species.
 * @param planet    - The planet where the outbreak begins.
 * @param population - Current population of the planet.
 * @param tick      - Current game tick.
 * @param rng       - Seeded random number generator (0–1).
 * @returns The new disease and an outbreak event.
 */
export function createOutbreak(
  speciesId: string,
  biology: BiologyType,
  planet: Planet,
  population: number,
  tick: number,
  rng: () => number = Math.random,
): { disease: Disease; event: DiseaseOutbreakEvent } {
  // Severity is weighted towards lower values (most outbreaks are mild).
  const severityRoll = rng();
  const severity = Math.ceil(severityRoll * severityRoll * 10); // Quadratic distribution → more mild

  const disease = generateDisease(speciesId, biology, severity, rng, 'natural', planet.id, tick);

  // Seed initial infections: 0.1%–1% of population depending on severity.
  const seedFraction = 0.001 + (severity / 10) * 0.009;
  disease.currentInfected = Math.max(1, Math.floor(population * seedFraction));

  const event: DiseaseOutbreakEvent = {
    type: 'disease_outbreak',
    diseaseId: disease.id,
    diseaseName: disease.name,
    planetId: planet.id,
    severity: disease.severity,
    initialInfected: disease.currentInfected,
  };

  return { disease, event };
}

// ---------------------------------------------------------------------------
// Public: computeHealthcareCost
// ---------------------------------------------------------------------------

/**
 * Compute the per-tick credit cost of running healthcare on a planet.
 *
 * Free healthcare is the most expensive to run. No healthcare costs nothing
 * but devastates population health and loyalty.
 *
 * @param population - Total population of the planet.
 * @param policy     - Current healthcare policy.
 * @returns Credit cost per tick.
 */
export function computeHealthcareCost(
  population: number,
  policy: HealthcarePolicy,
): number {
  const costPerCapita: Record<HealthcarePolicy, number> = {
    free: 0.003,
    semi_subsidised: 0.002,
    expensive: 0.001,
    none: 0,
  };
  return Math.round(population * costPerCapita[policy]);
}

// ---------------------------------------------------------------------------
// Public: getHealthcareEffectiveness
// ---------------------------------------------------------------------------

/**
 * Calculate the overall healthcare effectiveness for a planet, combining
 * medical infrastructure, policy quality, and staffing.
 *
 * This is useful for AI decision-making and UI display.
 *
 * @param buildings    - Buildings present on the planet.
 * @param policy       - Current healthcare policy.
 * @param demographics - Current demographic snapshot.
 * @returns Effectiveness score (0–100).
 */
export function getHealthcareEffectiveness(
  buildings: Building[],
  policy: HealthcarePolicy,
  demographics: PlanetDemographics,
): number {
  const medCap = medicalCapacity(buildings);
  const policyMultiplier = POLICY_QUALITY[policy];

  const baseEffectiveness = medCap * policyMultiplier;

  // Medical staff ratio bonus.
  const medicalStaffRatio = demographics.vocations.medical /
    Math.max(1, demographics.age.workingAge);
  const staffBonus = Math.min(15, medicalStaffRatio * 750);

  return clamp(Math.round(baseEffectiveness + staffBonus), 0, HEALTH_MAX);
}
