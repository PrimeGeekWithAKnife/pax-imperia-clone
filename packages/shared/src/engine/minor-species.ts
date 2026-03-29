/**
 * Minor species interaction engine — pure functions for discovering, interacting
 * with, and managing pre-spaceflight civilisations found on habitable planets.
 *
 * All functions are side-effect free. Callers must apply the returned state
 * and events to their own game state records.
 *
 * Design goals:
 *  - Minor species appear on planets as pre-spaceflight civilisations
 *  - Interaction options: Observe, Integrate, Uplift, Exploit, Enslave, Ignore, Research, Liberate
 *  - Left alone long enough, a very low chance of evolving to spacefaring (0.01% per tick)
 *  - Post-integration revolt is a real threat (Trojan horse mechanic)
 *  - Unique properties make minor species valuable allies or trade partners
 *  - Escalating revolt model: probability increases with unhappiness over time
 */

import type {
  MinorSpecies,
  MinorSpeciesBiology,
  MinorSpeciesInteraction,
  MinorSpeciesProperty,
  MinorSpeciesStatus,
  MinorSpeciesTechLevel,
  MinorSpeciesTraits,
  IntegrationProgress,
  UpliftProgress,
  RevoltState,
} from '../types/minor-species.js';
import { generateId } from '../utils/id.js';

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

/** Base event emitted by the minor species engine. */
export interface MinorSpeciesEventBase {
  type: string;
  speciesId: string;
}

/** Emitted when a minor species is first discovered. */
export interface DiscoveryEvent extends MinorSpeciesEventBase {
  type: 'minor_species_discovered';
  empireId: string;
  speciesName: string;
  biology: MinorSpeciesBiology;
  techLevel: MinorSpeciesTechLevel;
}

/** Emitted when an interaction is initiated. */
export interface InteractionStartEvent extends MinorSpeciesEventBase {
  type: 'minor_species_interaction_started';
  empireId: string;
  interaction: MinorSpeciesInteraction;
}

/** Emitted when a minor species advances a tech level on its own. */
export interface TechAdvancementEvent extends MinorSpeciesEventBase {
  type: 'minor_species_tech_advancement';
  previousLevel: MinorSpeciesTechLevel;
  newLevel: MinorSpeciesTechLevel;
}

/** Emitted when an integrated species' loyalty changes significantly. */
export interface LoyaltyChangeEvent extends MinorSpeciesEventBase {
  type: 'minor_species_loyalty_change';
  empireId: string;
  previousLoyalty: number;
  newLoyalty: number;
}

/** Emitted when a minor species revolts. */
export interface RevoltEvent extends MinorSpeciesEventBase {
  type: 'minor_species_revolt';
  empireId: string;
  strength: number;
  cause: string;
}

/** Emitted when a minor species becomes independent (spacefaring). */
export interface IndependenceEvent extends MinorSpeciesEventBase {
  type: 'minor_species_independence';
  speciesName: string;
}

/** Emitted when uplift completes. */
export interface UpliftCompleteEvent extends MinorSpeciesEventBase {
  type: 'minor_species_uplift_complete';
  empireId: string;
  newTechLevel: MinorSpeciesTechLevel;
}

/** Emitted when a species is liberated from exploitation or enslavement. */
export interface LiberationEvent extends MinorSpeciesEventBase {
  type: 'minor_species_liberated';
  empireId: string;
  previousStatus: MinorSpeciesStatus;
}

/** Emitted when research on a minor species yields a discovery. */
export interface ResearchYieldEvent extends MinorSpeciesEventBase {
  type: 'minor_species_research_yield';
  empireId: string;
  propertyId: string;
  propertyLabel: string;
}

/** Emitted when attitude changes due to exploitation or enslavement. */
export interface AttitudeChangeEvent extends MinorSpeciesEventBase {
  type: 'minor_species_attitude_change';
  previousAttitude: number;
  newAttitude: number;
}

/** Emitted when integration reaches a new stage. */
export interface IntegrationStageEvent extends MinorSpeciesEventBase {
  type: 'minor_species_integration_stage';
  empireId: string;
  newStage: 'early' | 'developing' | 'established' | 'harmonious';
}

export type MinorSpeciesEvent =
  | DiscoveryEvent
  | InteractionStartEvent
  | TechAdvancementEvent
  | LoyaltyChangeEvent
  | RevoltEvent
  | IndependenceEvent
  | UpliftCompleteEvent
  | LiberationEvent
  | ResearchYieldEvent
  | AttitudeChangeEvent
  | IntegrationStageEvent;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Probability per tick that an undiscovered species advances a tech level. */
export const NATURAL_TECH_ADVANCE_CHANCE = 0.0001;

/** Base revolt probability for integrated species with low loyalty. */
export const BASE_REVOLT_CHANCE = 0.01;

/** Revolt probability escalation per point of unhappiness below threshold. */
export const REVOLT_ESCALATION_PER_POINT = 0.01;

/** Loyalty threshold below which revolt becomes possible. */
export const REVOLT_LOYALTY_THRESHOLD = 30;

/** Attitude penalty per tick for exploited species. */
export const EXPLOIT_ATTITUDE_DECAY = -2;

/** Attitude penalty per tick for enslaved species. */
export const ENSLAVE_ATTITUDE_DECAY = -4;

/** Loyalty gain per tick for well-managed integration. */
export const INTEGRATION_LOYALTY_GAIN = 0.5;

/** Loyalty decay per tick when attitude is negative during integration. */
export const INTEGRATION_LOYALTY_DECAY = 0.3;

/** Cultural exchange gain per tick during integration. */
export const CULTURAL_EXCHANGE_GAIN = 0.2;

/** Ticks per uplift level step (base value, modified by species adaptability). */
export const UPLIFT_TICKS_PER_LEVEL = 50;

/** Stability loss per tick during uplift. */
export const UPLIFT_STABILITY_DECAY = 0.1;

// ---------------------------------------------------------------------------
// Tech level progression order
// ---------------------------------------------------------------------------

const TECH_LEVEL_ORDER: MinorSpeciesTechLevel[] = [
  'stone_age',
  'bronze_age',
  'iron_age',
  'medieval',
  'renaissance',
  'industrial',
  'early_modern',
];

// ---------------------------------------------------------------------------
// Name tables — 30 unique procedural names, varied by biology type
// ---------------------------------------------------------------------------

const NAMES_CARBON_TERRESTRIAL = [
  'Vethani', 'Korthani', 'Drelosi', 'Talvarni', 'Oshkari',
];

const NAMES_CARBON_AQUATIC = [
  'Pelathri', 'Undessi', 'Coralith', 'Abyssari', 'Thalveni',
];

const NAMES_CARBON_AERIAL = [
  'Zephyrai', 'Skytha', 'Aeloni', 'Cirrani', 'Venthari',
];

const NAMES_SILICON_BASED = [
  'Lithvari', 'Crysthari', 'Quartzeni', 'Obsidari', 'Geolith',
];

const NAMES_FUNGAL_NETWORK = [
  'Mycenari', 'Sporathi', 'Rhizoli', 'Hypha', 'Thallorim',
];

const NAMES_INSECTOID_SWARM = [
  'Chithari', 'Skarabix', 'Formicai', 'Vespari', 'Manthari',
];

const NAMES_MEGAFAUNA = [
  'Titanari', 'Behemari', 'Colossith', 'Leviathri', 'Garganthi',
];

const NAME_TABLE: Record<MinorSpeciesBiology, string[]> = {
  carbon_terrestrial: NAMES_CARBON_TERRESTRIAL,
  carbon_aquatic: NAMES_CARBON_AQUATIC,
  carbon_aerial: NAMES_CARBON_AERIAL,
  silicon_based: NAMES_SILICON_BASED,
  fungal_network: NAMES_FUNGAL_NETWORK,
  insectoid_swarm: NAMES_INSECTOID_SWARM,
  megafauna: NAMES_MEGAFAUNA,
};

// ---------------------------------------------------------------------------
// Property templates — unique properties by biology type
// ---------------------------------------------------------------------------

const PROPERTY_TEMPLATES: Record<MinorSpeciesBiology, MinorSpeciesProperty[]> = {
  carbon_terrestrial: [
    { id: 'versatile_labour', label: 'Versatile Labour Force', description: 'Adaptable workers who can fill almost any industrial role.', category: 'construction', magnitude: 5 },
    { id: 'cultural_richness', label: 'Rich Cultural Heritage', description: 'A vibrant artistic tradition that boosts morale across your empire.', category: 'happiness', magnitude: 6 },
  ],
  carbon_aquatic: [
    { id: 'deep_sea_mining', label: 'Deep-Sea Mineral Sensitivity', description: 'Innate ability to detect mineral deposits beneath ocean floors.', category: 'economy', magnitude: 7 },
    { id: 'bioluminescent_comms', label: 'Bioluminescent Communication', description: 'Natural encryption through light-based signalling, useful for intelligence work.', category: 'espionage', magnitude: 6 },
  ],
  carbon_aerial: [
    { id: 'atmospheric_scouts', label: 'Atmospheric Reconnaissance', description: 'Natural fliers make exceptional scouts and surveillance operatives.', category: 'espionage', magnitude: 7 },
    { id: 'wind_architecture', label: 'Aerodynamic Engineering', description: 'Instinctive understanding of fluid dynamics improves construction efficiency.', category: 'construction', magnitude: 5 },
  ],
  silicon_based: [
    { id: 'exotic_biology_research', label: 'Exotic Biology', description: 'Silicon biochemistry opens entirely new avenues of scientific research.', category: 'research', magnitude: 8 },
    { id: 'mineral_affinity', label: 'Mineral Affinity', description: 'Intuitive understanding of crystalline structures improves mining yields.', category: 'economy', magnitude: 7 },
  ],
  fungal_network: [
    { id: 'distributed_intelligence', label: 'Distributed Intelligence Network', description: 'Mycelial communication networks enable rapid information processing.', category: 'research', magnitude: 7 },
    { id: 'bioremediation', label: 'Bioremediation Capability', description: 'Natural ability to break down pollutants and restore ecosystems.', category: 'happiness', magnitude: 5 },
  ],
  insectoid_swarm: [
    { id: 'swarm_labour', label: 'Swarm Construction Crews', description: 'Coordinated mass labour achieves construction feats no other species can match.', category: 'construction', magnitude: 9 },
    { id: 'hive_defence', label: 'Hive Defence Instinct', description: 'Fanatical defensive coordination when the colony is threatened.', category: 'military', magnitude: 7 },
  ],
  megafauna: [
    { id: 'heavy_labour', label: 'Immense Physical Strength', description: 'Able to perform heavy industrial tasks without mechanical assistance.', category: 'construction', magnitude: 8 },
    { id: 'intimidation_factor', label: 'Intimidation Factor', description: 'Sheer size deters would-be aggressors, providing a passive military advantage.', category: 'military', magnitude: 6 },
  ],
};

// ---------------------------------------------------------------------------
// Description templates by biology
// ---------------------------------------------------------------------------

const DESCRIPTION_TEMPLATES: Record<MinorSpeciesBiology, string[]> = {
  carbon_terrestrial: [
    'A bipedal species with a complex social hierarchy and rudimentary tool use.',
    'Tool-using primates with early agricultural practices and tribal governance.',
    'A communal species that builds permanent settlements from local materials.',
  ],
  carbon_aquatic: [
    'An aquatic civilisation dwelling in coral-like reef structures beneath the waves.',
    'Deep-ocean dwellers who communicate through patterns of bioluminescence.',
    'A semi-amphibious species that builds both underwater and coastal settlements.',
  ],
  carbon_aerial: [
    'A winged species that nests in towering cliff-face colonies.',
    'Avian beings with intricate aerial courtship displays and sky-temple architecture.',
    'Gliding beings that have mastered air currents for trade and communication.',
  ],
  silicon_based: [
    'Crystalline beings that grow slowly but are nearly indestructible by conventional means.',
    'A silicon-based species that derives energy directly from geological heat vents.',
    'Rock-like entities whose thought processes operate on geological timescales.',
  ],
  fungal_network: [
    'A vast mycelial network that spans kilometres, with intelligence distributed across the whole.',
    'Fruiting-body intelligences connected by underground filaments — less a species, more a mind.',
    'Spore-based communicators whose ideas literally spread on the wind.',
  ],
  insectoid_swarm: [
    'A eusocial insectoid swarm governed by chemical signals from a central queen caste.',
    'Chitinous builders whose hive-mounds rival mountains in scale and complexity.',
    'A swarm intelligence with specialised castes for every conceivable function.',
  ],
  megafauna: [
    'Enormous quadrupeds whose rumbling vocalisations can be felt kilometres away.',
    'A species of gentle giants with surprisingly delicate manipulatory appendages.',
    'Colossal beings that reshape their environment simply by moving through it.',
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Pick a random element from an array using the provided RNG.
 */
function pickRandom<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Get the next tech level in the progression, or null if already at the cap.
 */
function nextTechLevel(current: MinorSpeciesTechLevel): MinorSpeciesTechLevel | null {
  const idx = TECH_LEVEL_ORDER.indexOf(current);
  if (idx < 0 || idx >= TECH_LEVEL_ORDER.length - 1) return null;
  return TECH_LEVEL_ORDER[idx + 1];
}

/**
 * Count how many tech levels separate two levels.
 */
function techLevelDistance(from: MinorSpeciesTechLevel, to: MinorSpeciesTechLevel): number {
  const fromIdx = TECH_LEVEL_ORDER.indexOf(from);
  const toIdx = TECH_LEVEL_ORDER.indexOf(to);
  return Math.abs(toIdx - fromIdx);
}

/**
 * Determine integration stage from ticks integrated.
 */
function integrationStage(ticksIntegrated: number): 'early' | 'developing' | 'established' | 'harmonious' {
  if (ticksIntegrated < 50) return 'early';
  if (ticksIntegrated < 150) return 'developing';
  if (ticksIntegrated < 300) return 'established';
  return 'harmonious';
}

// ---------------------------------------------------------------------------
// Public API — name generation
// ---------------------------------------------------------------------------

/**
 * Generate a procedural name for a minor species based on its biology type.
 *
 * Uses a table of 30+ curated name roots (5 per biology type) combined with
 * optional suffixes for variety. Names are chosen deterministically given the
 * same RNG state, making them reproducible in tests.
 *
 * @param biology - The species' biology type, used to select the name pool.
 * @param rng    - Random number generator for deterministic testing.
 * @returns A species name string.
 */
export function generateMinorSpeciesName(biology: MinorSpeciesBiology, rng: () => number): string {
  const names = NAME_TABLE[biology];
  return pickRandom(names, rng);
}

// ---------------------------------------------------------------------------
// Public API — species generation
// ---------------------------------------------------------------------------

/**
 * Generate a new minor species for a given planet.
 *
 * Creates a fully-populated MinorSpecies object with randomised traits,
 * a procedural name, a biology-appropriate description, and one or two
 * unique properties drawn from biology-specific templates.
 *
 * The species starts as 'undiscovered' with a neutral attitude.
 *
 * @param planetId - ID of the planet this species inhabits.
 * @param systemId - ID of the star system containing the planet.
 * @param rng      - Random number generator for deterministic testing.
 * @returns A new MinorSpecies object.
 */
export function generateMinorSpecies(
  planetId: string,
  systemId: string,
  rng: () => number,
): MinorSpecies {
  const biologies: MinorSpeciesBiology[] = [
    'carbon_terrestrial', 'carbon_aquatic', 'carbon_aerial',
    'silicon_based', 'fungal_network', 'insectoid_swarm', 'megafauna',
  ];

  const biology = pickRandom(biologies, rng);
  const name = generateMinorSpeciesName(biology, rng);
  const description = pickRandom(DESCRIPTION_TEMPLATES[biology], rng);

  // Randomise a tech level, weighted toward lower levels
  const techLevelWeights = [0.30, 0.25, 0.20, 0.12, 0.07, 0.04, 0.02];
  let cumulativeWeight = 0;
  const roll = rng();
  let techLevel: MinorSpeciesTechLevel = 'stone_age';
  for (let i = 0; i < TECH_LEVEL_ORDER.length; i++) {
    cumulativeWeight += techLevelWeights[i];
    if (roll < cumulativeWeight) {
      techLevel = TECH_LEVEL_ORDER[i];
      break;
    }
  }

  const traits: MinorSpeciesTraits = {
    aggression: Math.floor(rng() * 10) + 1,
    curiosity: Math.floor(rng() * 10) + 1,
    industriousness: Math.floor(rng() * 10) + 1,
    adaptability: Math.floor(rng() * 10) + 1,
  };

  // Population scales with tech level (higher tech = larger population)
  const techIdx = TECH_LEVEL_ORDER.indexOf(techLevel);
  const basePopulation = 1_000 + techIdx * 50_000;
  const populationVariance = Math.floor(rng() * basePopulation * 0.5);
  const population = basePopulation + populationVariance;

  // Assign 1–2 unique properties from the biology-specific template
  const allProperties = PROPERTY_TEMPLATES[biology];
  const properties: MinorSpeciesProperty[] = [];
  if (allProperties.length > 0) {
    properties.push(allProperties[0]);
    if (allProperties.length > 1 && rng() > 0.4) {
      properties.push(allProperties[1]);
    }
  }

  return {
    id: generateId(),
    name,
    description,
    planetId,
    systemId,
    population,
    techLevel,
    biology,
    traits,
    attitude: 0,
    status: 'undiscovered',
    properties,
    integration: null,
    uplift: null,
    revolt: null,
    interactingEmpireId: null,
    currentInteraction: null,
  };
}

// ---------------------------------------------------------------------------
// Public API — discovery
// ---------------------------------------------------------------------------

/**
 * Transition a minor species from 'undiscovered' to 'observed'.
 *
 * This is called when a scanning ship or colony first detects life signs on a
 * planet. It does not alter the species' attitude — mere observation is
 * non-intrusive.
 *
 * @param species           - The species to discover.
 * @param discoveringEmpireId - ID of the empire that made the discovery.
 * @returns An updated species object and a discovery event.
 */
export function discoverMinorSpecies(
  species: MinorSpecies,
  discoveringEmpireId: string,
): { species: MinorSpecies; events: MinorSpeciesEvent[] } {
  if (species.status !== 'undiscovered') {
    return { species: { ...species }, events: [] };
  }

  const updated: MinorSpecies = {
    ...species,
    status: 'observed',
    interactingEmpireId: discoveringEmpireId,
  };

  const event: DiscoveryEvent = {
    type: 'minor_species_discovered',
    speciesId: species.id,
    empireId: discoveringEmpireId,
    speciesName: species.name,
    biology: species.biology,
    techLevel: species.techLevel,
  };

  return { species: updated, events: [event] };
}

// ---------------------------------------------------------------------------
// Public API — initiate interaction
// ---------------------------------------------------------------------------

/**
 * Begin an interaction with a minor species.
 *
 * The species must be at least 'observed' before any interaction can begin.
 * Each interaction type has different prerequisites and immediate effects:
 *
 * - **observe**: Passive study; no status change beyond 'observed'.
 * - **integrate**: Begin absorbing the species into the empire (status → 'contacted' then 'integrated').
 * - **uplift**: Accelerate their technological development (requires 'contacted' or better).
 * - **exploit**: Extract resources from the species at the cost of their wellbeing.
 * - **enslave**: Forced labour; severe attitude penalties, high revolt risk.
 * - **ignore**: Cease all interaction; the species reverts to developing naturally.
 * - **research**: Study the species' unique biology for scientific gain.
 * - **liberate**: Free an exploited/enslaved species; massive attitude boost.
 *
 * @param species     - The minor species to interact with.
 * @param interaction - The type of interaction to initiate.
 * @param empireId    - ID of the empire initiating the interaction.
 * @returns Updated species and any emitted events.
 */
export function initiateInteraction(
  species: MinorSpecies,
  interaction: MinorSpeciesInteraction,
  empireId: string,
): { species: MinorSpecies; events: MinorSpeciesEvent[] } {
  const events: MinorSpeciesEvent[] = [];

  // Must be at least observed to interact
  if (species.status === 'undiscovered') {
    return { species: { ...species }, events: [] };
  }

  let updated: MinorSpecies = { ...species };

  switch (interaction) {
    case 'observe': {
      updated.currentInteraction = 'observe';
      updated.interactingEmpireId = empireId;
      break;
    }

    case 'integrate': {
      updated.status = 'contacted';
      updated.currentInteraction = 'integrate';
      updated.interactingEmpireId = empireId;
      updated.integration = {
        empireId,
        ticksIntegrated: 0,
        loyalty: 50 + Math.floor(species.traits.curiosity * 3), // Curious species start more loyal
        revoltRisk: 0,
        culturalExchange: 0,
        stage: 'early',
      };
      break;
    }

    case 'uplift': {
      const targetLevel = nextTechLevel(species.techLevel);
      if (!targetLevel) {
        // Already at cap — no uplift possible
        return { species: { ...species }, events: [] };
      }
      updated.currentInteraction = 'uplift';
      updated.interactingEmpireId = empireId;
      // Adaptability reduces uplift time
      const adaptabilityFactor = 1 - (species.traits.adaptability - 1) / 18;
      const ticksRequired = Math.ceil(UPLIFT_TICKS_PER_LEVEL * adaptabilityFactor);
      updated.uplift = {
        empireId,
        startingTechLevel: species.techLevel,
        targetTechLevel: targetLevel,
        ticksRemaining: ticksRequired,
        stability: 100,
      };
      // Small attitude boost — they appreciate the help
      updated.attitude = clamp(updated.attitude + 10, -100, 100);
      break;
    }

    case 'exploit': {
      updated.status = 'exploited';
      updated.currentInteraction = 'exploit';
      updated.interactingEmpireId = empireId;
      // Immediate attitude hit
      updated.attitude = clamp(updated.attitude - 20, -100, 100);
      break;
    }

    case 'enslave': {
      updated.status = 'enslaved';
      updated.currentInteraction = 'enslave';
      updated.interactingEmpireId = empireId;
      // Severe immediate attitude hit
      updated.attitude = clamp(updated.attitude - 50, -100, 100);
      break;
    }

    case 'ignore': {
      updated.currentInteraction = null;
      updated.interactingEmpireId = null;
      // If they were contacted but not yet integrated, revert to observed
      if (updated.status === 'contacted') {
        updated.status = 'observed';
      }
      updated.integration = null;
      updated.uplift = null;
      break;
    }

    case 'research': {
      updated.currentInteraction = 'research';
      updated.interactingEmpireId = empireId;
      // Curiosity-driven species react positively to being studied
      const attitudeShift = species.traits.curiosity > 5 ? 5 : -5;
      updated.attitude = clamp(updated.attitude + attitudeShift, -100, 100);
      break;
    }

    case 'liberate': {
      if (species.status !== 'exploited' && species.status !== 'enslaved') {
        return { species: { ...species }, events: [] };
      }
      const previousStatus = species.status;
      updated.status = 'observed';
      updated.currentInteraction = null;
      updated.interactingEmpireId = empireId;
      // Massive attitude boost from liberation
      updated.attitude = clamp(updated.attitude + 60, -100, 100);
      updated.integration = null;
      updated.revolt = null;

      events.push({
        type: 'minor_species_liberated',
        speciesId: species.id,
        empireId,
        previousStatus,
      });
      break;
    }
  }

  events.push({
    type: 'minor_species_interaction_started',
    speciesId: species.id,
    empireId,
    interaction,
  });

  return { species: updated, events };
}

// ---------------------------------------------------------------------------
// Public API — revolt check
// ---------------------------------------------------------------------------

/**
 * Check whether a minor species revolts this tick.
 *
 * Revolt probability uses an escalating model: it starts at 1% and increases
 * by 1% for each point of loyalty below the revolt threshold. Aggressive
 * species are more likely to revolt, and enslaved species have an additional
 * base penalty.
 *
 * The formula:
 *   unhappiness = max(0, REVOLT_LOYALTY_THRESHOLD - loyalty)
 *   revoltChance = BASE_REVOLT_CHANCE + (unhappiness * REVOLT_ESCALATION_PER_POINT)
 *   revoltChance += (aggression / 100)   // aggressive species are more volatile
 *   if enslaved: revoltChance += 0.05    // enslavement is inherently unstable
 *
 * @param species - The minor species to check.
 * @param rng     - Random number generator.
 * @returns Whether a revolt occurs, its strength, and the cause.
 */
export function checkRevolt(
  species: MinorSpecies,
  rng: () => number,
): { revolting: boolean; strength: number; cause: string } {
  // Only integrated, exploited, or enslaved species can revolt
  if (species.status !== 'integrated' && species.status !== 'exploited' && species.status !== 'enslaved') {
    return { revolting: false, strength: 0, cause: '' };
  }

  const loyalty = species.integration?.loyalty ?? 50;
  const unhappiness = Math.max(0, REVOLT_LOYALTY_THRESHOLD - loyalty);

  let revoltChance = BASE_REVOLT_CHANCE + (unhappiness * REVOLT_ESCALATION_PER_POINT);
  revoltChance += species.traits.aggression / 100;

  if (species.status === 'enslaved') {
    revoltChance += 0.05;
  }

  if (species.status === 'exploited') {
    revoltChance += 0.02;
  }

  // Attitude affects revolt — very negative attitude makes revolt more likely
  if (species.attitude < -50) {
    revoltChance += 0.03;
  }

  revoltChance = clamp(revoltChance, 0, 1);

  const roll = rng();
  if (roll >= revoltChance) {
    return { revolting: false, strength: 0, cause: '' };
  }

  // Revolt strength based on population, aggression, and tech level
  const techIdx = TECH_LEVEL_ORDER.indexOf(species.techLevel);
  const baseStrength = 10 + (species.traits.aggression * 5) + (techIdx * 8);
  const strength = clamp(baseStrength + Math.floor(rng() * 20), 0, 100);

  let cause = 'General unrest';
  if (species.status === 'enslaved') {
    cause = 'Uprising against enslavement';
  } else if (species.status === 'exploited') {
    cause = 'Resistance to exploitation';
  } else if (loyalty < 15) {
    cause = 'Cultural incompatibility and resentment';
  } else if (species.attitude < -70) {
    cause = 'Deep-seated hatred of the occupying empire';
  }

  return { revolting: true, strength, cause };
}

// ---------------------------------------------------------------------------
// Public API — per-tick processing
// ---------------------------------------------------------------------------

/**
 * Process one game tick for a minor species.
 *
 * This is the main per-tick update function. It handles all status-dependent
 * behaviour:
 *
 * - **Undiscovered / observed (no interaction)**: small chance of natural tech
 *   advancement (0.01% per tick). At 'early_modern', a further roll determines
 *   whether the species achieves spaceflight and becomes an independent power.
 *
 * - **Integrated**: loyalty drifts based on attitude and traits. Cultural
 *   exchange increases over time. Revolt is checked each tick.
 *
 * - **Exploited / enslaved**: attitude degrades each tick. Revolt probability
 *   escalates with mounting unhappiness.
 *
 * - **Uplifting**: ticks remaining count down. Stability may degrade if the
 *   uplift is too rapid for the species' adaptability.
 *
 * - **Revolting**: revolt strength may grow or decay. If strength reaches zero,
 *   the revolt ends.
 *
 * @param species  - The species to process.
 * @param empireId - ID of the empire interacting with this species (may be null).
 * @param tick     - Current game tick number.
 * @param rng      - Random number generator for deterministic testing.
 * @returns Updated species state and any emitted events.
 */
export function processMinorSpeciesTick(
  species: MinorSpecies,
  empireId: string | null,
  tick: number,
  rng: () => number,
): { species: MinorSpecies; events: MinorSpeciesEvent[] } {
  const events: MinorSpeciesEvent[] = [];
  let updated: MinorSpecies = {
    ...species,
    traits: { ...species.traits },
    properties: [...species.properties],
    integration: species.integration ? { ...species.integration } : null,
    uplift: species.uplift ? { ...species.uplift } : null,
    revolt: species.revolt ? { ...species.revolt, allies: [...(species.revolt.allies)] } : null,
  };

  // ── Natural tech advancement (undiscovered or observed with no interaction) ─
  if (
    (updated.status === 'undiscovered' || updated.status === 'observed') &&
    updated.currentInteraction === null
  ) {
    updated = processNaturalAdvancement(updated, events, rng);
    return { species: updated, events };
  }

  // ── Integration processing ────────────────────────────────────────────────
  if (updated.status === 'integrated' || updated.status === 'contacted') {
    if (updated.currentInteraction === 'integrate' && updated.integration) {
      updated = processIntegration(updated, events, rng);
    }
  }

  // ── Uplift processing ─────────────────────────────────────────────────────
  if (updated.currentInteraction === 'uplift' && updated.uplift) {
    updated = processUplift(updated, events, rng);
  }

  // ── Exploitation / enslavement processing ─────────────────────────────────
  if (updated.status === 'exploited' || updated.status === 'enslaved') {
    updated = processExploitation(updated, events, rng);
  }

  // ── Research processing ───────────────────────────────────────────────────
  if (updated.currentInteraction === 'research' && empireId) {
    updated = processResearch(updated, empireId, events, rng);
  }

  // ── Active revolt processing ──────────────────────────────────────────────
  if (updated.status === 'revolting' && updated.revolt?.active) {
    updated = processActiveRevolt(updated, events, rng);
  }

  return { species: updated, events };
}

// ---------------------------------------------------------------------------
// Internal tick processors
// ---------------------------------------------------------------------------

/**
 * Handle natural tech advancement for undiscovered or uninteracted species.
 */
function processNaturalAdvancement(
  species: MinorSpecies,
  events: MinorSpeciesEvent[],
  rng: () => number,
): MinorSpecies {
  let updated = { ...species };

  if (rng() < NATURAL_TECH_ADVANCE_CHANCE) {
    const next = nextTechLevel(updated.techLevel);
    if (next) {
      const previousLevel = updated.techLevel;
      updated.techLevel = next;
      // Population grows with tech advancement
      updated.population = Math.floor(updated.population * 1.5);
      events.push({
        type: 'minor_species_tech_advancement',
        speciesId: updated.id,
        previousLevel,
        newLevel: next,
      });
    }
  }

  // At early_modern, very small chance of achieving spaceflight
  if (updated.techLevel === 'early_modern' && rng() < NATURAL_TECH_ADVANCE_CHANCE * 0.1) {
    updated.status = 'independent';
    events.push({
      type: 'minor_species_independence',
      speciesId: updated.id,
      speciesName: updated.name,
    });
  }

  return updated;
}

/**
 * Process integration loyalty drift, cultural exchange, and revolt checks.
 */
function processIntegration(
  species: MinorSpecies,
  events: MinorSpeciesEvent[],
  rng: () => number,
): MinorSpecies {
  const updated = { ...species, integration: { ...species.integration! } };
  const integration = updated.integration;

  integration.ticksIntegrated += 1;

  // Loyalty drifts based on attitude
  if (updated.attitude > 0) {
    const curiosityBonus = updated.traits.curiosity / 20;
    integration.loyalty = clamp(
      integration.loyalty + INTEGRATION_LOYALTY_GAIN + curiosityBonus,
      0,
      100,
    );
  } else {
    const aggressionPenalty = updated.traits.aggression / 20;
    integration.loyalty = clamp(
      integration.loyalty - INTEGRATION_LOYALTY_DECAY - aggressionPenalty,
      0,
      100,
    );
  }

  // Cultural exchange grows over time
  const exchangeBonus = updated.traits.adaptability / 50;
  integration.culturalExchange = clamp(
    integration.culturalExchange + CULTURAL_EXCHANGE_GAIN + exchangeBonus,
    0,
    100,
  );

  // Check stage advancement
  const previousStage = integration.stage;
  integration.stage = integrationStage(integration.ticksIntegrated);
  if (integration.stage !== previousStage) {
    events.push({
      type: 'minor_species_integration_stage',
      speciesId: updated.id,
      empireId: integration.empireId,
      newStage: integration.stage,
    });
  }

  // Transition from contacted to integrated once loyalty is sufficient
  if (updated.status === 'contacted' && integration.loyalty >= 60) {
    updated.status = 'integrated';
  }

  // Calculate revolt risk
  const unhappiness = Math.max(0, REVOLT_LOYALTY_THRESHOLD - integration.loyalty);
  integration.revoltRisk = clamp(
    BASE_REVOLT_CHANCE + (unhappiness * REVOLT_ESCALATION_PER_POINT),
    0,
    1,
  );

  // Revolt check
  if (updated.status === 'integrated') {
    const revoltResult = checkRevolt(updated, rng);
    if (revoltResult.revolting) {
      updated.status = 'revolting';
      updated.revolt = {
        active: true,
        strength: revoltResult.strength,
        cause: revoltResult.cause,
        allies: [],
      };
      events.push({
        type: 'minor_species_revolt',
        speciesId: updated.id,
        empireId: integration.empireId,
        strength: revoltResult.strength,
        cause: revoltResult.cause,
      });
    }
  }

  return updated;
}

/**
 * Process uplift progress. Ticks down, stability may degrade.
 */
function processUplift(
  species: MinorSpecies,
  events: MinorSpeciesEvent[],
  _rng: () => number,
): MinorSpecies {
  const updated = { ...species, uplift: { ...species.uplift! } };
  const uplift = updated.uplift;

  uplift.ticksRemaining -= 1;

  // Stability degrades faster for less adaptable species
  const stabilityLoss = UPLIFT_STABILITY_DECAY * (1 + (10 - updated.traits.adaptability) / 10);
  uplift.stability = clamp(uplift.stability - stabilityLoss, 0, 100);

  // Uplift complete
  if (uplift.ticksRemaining <= 0) {
    updated.techLevel = uplift.targetTechLevel;
    updated.status = 'uplifted';
    updated.currentInteraction = null;
    updated.population = Math.floor(updated.population * 1.2);

    events.push({
      type: 'minor_species_uplift_complete',
      speciesId: updated.id,
      empireId: uplift.empireId,
      newTechLevel: uplift.targetTechLevel,
    });

    // Small attitude boost on completion
    updated.attitude = clamp(updated.attitude + 15, -100, 100);
  }

  return updated;
}

/**
 * Process exploitation and enslavement: attitude decay and revolt escalation.
 */
function processExploitation(
  species: MinorSpecies,
  events: MinorSpeciesEvent[],
  rng: () => number,
): MinorSpecies {
  const updated = { ...species };
  const previousAttitude = updated.attitude;

  // Attitude degrades each tick
  if (updated.status === 'enslaved') {
    updated.attitude = clamp(updated.attitude + ENSLAVE_ATTITUDE_DECAY, -100, 100);
  } else {
    updated.attitude = clamp(updated.attitude + EXPLOIT_ATTITUDE_DECAY, -100, 100);
  }

  if (Math.abs(updated.attitude - previousAttitude) >= 10) {
    events.push({
      type: 'minor_species_attitude_change',
      speciesId: updated.id,
      previousAttitude,
      newAttitude: updated.attitude,
    });
  }

  // Revolt check for exploited/enslaved species
  const revoltResult = checkRevolt(updated, rng);
  if (revoltResult.revolting) {
    updated.status = 'revolting';
    updated.revolt = {
      active: true,
      strength: revoltResult.strength,
      cause: revoltResult.cause,
      allies: [],
    };
    events.push({
      type: 'minor_species_revolt',
      speciesId: updated.id,
      empireId: updated.interactingEmpireId ?? '',
      strength: revoltResult.strength,
      cause: revoltResult.cause,
    });
  }

  return updated;
}

/**
 * Process research on a minor species — chance to yield a discovery each tick.
 */
function processResearch(
  species: MinorSpecies,
  empireId: string,
  events: MinorSpeciesEvent[],
  rng: () => number,
): MinorSpecies {
  const updated = { ...species };

  // 5% chance per tick to yield a research insight from the species' properties
  if (updated.properties.length > 0 && rng() < 0.05) {
    const property = pickRandom(updated.properties, rng);
    events.push({
      type: 'minor_species_research_yield',
      speciesId: updated.id,
      empireId,
      propertyId: property.id,
      propertyLabel: property.label,
    });
  }

  // Research improves attitude slightly (they appreciate the interest)
  if (updated.traits.curiosity > 5) {
    updated.attitude = clamp(updated.attitude + 0.1, -100, 100);
  }

  return updated;
}

/**
 * Process an active revolt: strength may grow or decay over time.
 */
function processActiveRevolt(
  species: MinorSpecies,
  events: MinorSpeciesEvent[],
  rng: () => number,
): MinorSpecies {
  const updated = {
    ...species,
    revolt: { ...species.revolt!, allies: [...(species.revolt?.allies ?? [])] },
  };
  const revolt = updated.revolt;

  // Revolt strength fluctuates
  const aggressionFactor = updated.traits.aggression / 10;
  const strengthDelta = (rng() * 10 - 4) * aggressionFactor; // Slightly biased toward growth
  revolt.strength = clamp(revolt.strength + strengthDelta, 0, 100);

  // If strength drops to zero, the revolt is suppressed
  if (revolt.strength <= 0) {
    revolt.active = false;
    updated.status = 'integrated';
    updated.attitude = clamp(updated.attitude - 10, -100, 100);
    // Reset integration loyalty to a low value post-revolt
    if (updated.integration) {
      updated.integration = {
        ...updated.integration,
        loyalty: 20,
        revoltRisk: 0,
      };
    }
  }

  return updated;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/** Human-readable label for a MinorSpeciesInteraction. */
export function getInteractionLabel(interaction: MinorSpeciesInteraction): string {
  switch (interaction) {
    case 'observe':   return 'Observe';
    case 'integrate': return 'Integrate';
    case 'uplift':    return 'Uplift';
    case 'exploit':   return 'Exploit';
    case 'enslave':   return 'Enslave';
    case 'ignore':    return 'Ignore';
    case 'research':  return 'Research';
    case 'liberate':  return 'Liberate';
    default: {
      const _exhaustive: never = interaction;
      return String(_exhaustive);
    }
  }
}

/** Human-readable label for a MinorSpeciesStatus. */
export function getMinorSpeciesStatusLabel(status: MinorSpeciesStatus): string {
  switch (status) {
    case 'undiscovered': return 'Undiscovered';
    case 'observed':     return 'Observed';
    case 'contacted':    return 'First Contact';
    case 'integrated':   return 'Integrated';
    case 'uplifted':     return 'Uplifted';
    case 'exploited':    return 'Exploited';
    case 'enslaved':     return 'Enslaved';
    case 'revolting':    return 'In Revolt';
    case 'independent':  return 'Independent';
    default: {
      const _exhaustive: never = status;
      return String(_exhaustive);
    }
  }
}

/** Human-readable label for a MinorSpeciesTechLevel. */
export function getTechLevelLabel(techLevel: MinorSpeciesTechLevel): string {
  switch (techLevel) {
    case 'stone_age':    return 'Stone Age';
    case 'bronze_age':   return 'Bronze Age';
    case 'iron_age':     return 'Iron Age';
    case 'medieval':     return 'Medieval';
    case 'renaissance':  return 'Renaissance';
    case 'industrial':   return 'Industrial';
    case 'early_modern': return 'Early Modern';
    default: {
      const _exhaustive: never = techLevel;
      return String(_exhaustive);
    }
  }
}

/** Human-readable label for a MinorSpeciesBiology. */
export function getBiologyLabel(biology: MinorSpeciesBiology): string {
  switch (biology) {
    case 'carbon_terrestrial': return 'Carbon-Based Terrestrial';
    case 'carbon_aquatic':     return 'Carbon-Based Aquatic';
    case 'carbon_aerial':      return 'Carbon-Based Aerial';
    case 'silicon_based':      return 'Silicon-Based';
    case 'fungal_network':     return 'Fungal Network';
    case 'insectoid_swarm':    return 'Insectoid Swarm';
    case 'megafauna':          return 'Megafauna';
    default: {
      const _exhaustive: never = biology;
      return String(_exhaustive);
    }
  }
}
