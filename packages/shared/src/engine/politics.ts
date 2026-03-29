/**
 * Political factions engine — pure functions for faction generation, political
 * ticks, elections, and corruption.
 *
 * Factions are not passive opinion polls. They are ACTIVE agents within a
 * society: lobbying, funding campaigns, organising strikes, leading protests,
 * and — when pushed far enough — attempting coups. They emerge from the
 * demographics of an empire and dissolve when their support base vanishes.
 *
 * All functions are pure / side-effect-free. Callers must persist state.
 *
 * Design:
 *  - Hybrid model: 2-3 species-specific starter factions + demographics-driven emergence
 *  - 2-5 active factions at any time (form and dissolve dynamically)
 *  - 7 policy domains: foreign, domestic, economic, political, education, health, security
 *  - Escalation ladder: lobbying → funding → strikes → protests → coup
 *  - Corruption driven by: enforcement, inequality, empire size, foreign interference
 *  - Elections for democratic government types
 */

import type { GovernmentType } from '../types/government.js';
import type { PlanetDemographics } from '../types/demographics.js';
import { generateId } from '../utils/id.js';

// ---------------------------------------------------------------------------
// Public types (self-contained — no dependency on a separate politics.ts)
// ---------------------------------------------------------------------------

/** The 7 policy domains that factions care about. */
export type PolicyDomain =
  | 'foreign'
  | 'domestic'
  | 'economic'
  | 'political'
  | 'education'
  | 'health'
  | 'security';

export const ALL_POLICY_DOMAINS: PolicyDomain[] = [
  'foreign', 'domestic', 'economic', 'political', 'education', 'health', 'security',
];

/** Escalation actions a faction can take, ordered from mild to extreme. */
export type FactionAction = 'lobbying' | 'funding' | 'strikes' | 'protests' | 'coup';

/** Ordered escalation ladder — each step is more disruptive than the last. */
const ESCALATION_LADDER: FactionAction[] = [
  'lobbying', 'funding', 'strikes', 'protests', 'coup',
];

/** A policy demand: a value between -100 (strongly oppose) and +100 (strongly favour). */
export interface PolicyDemand {
  domain: PolicyDomain;
  /** -100 to +100 representing the faction's desired policy position. */
  value: number;
}

/** What demographic segments feed a faction's support base. */
export interface FactionSupportSources {
  vocation?: string;
  faith?: string;
  loyalty?: string;
  wealthLevel?: string;
}

/** A political faction within an empire. */
export interface PoliticalFaction {
  id: string;
  name: string;
  /** Which species this faction was spawned for (starter factions). */
  speciesOrigin?: string;
  /** Fraction of the population that actively supports this faction (0.0-1.0). */
  supportBase: number;
  /** Political influence / power multiplier. Affected by wealth, connections, ruling status. */
  clout: number;
  /** How happy the faction is with current policies (-100 to +100). */
  satisfaction: number;
  /** What the faction wants. */
  demands: PolicyDemand[];
  /** What the faction is currently doing about its demands. */
  currentAction: FactionAction;
  /** Whether this faction currently holds power. */
  isRulingFaction: boolean;
  /** Tick on which this faction was created. */
  foundedTick: number;
  /** Whether this faction has been dissolved. */
  dissolved: boolean;
  /** Which demographic segments feed this faction's support. */
  supportSources: FactionSupportSources;
  /** How many consecutive ticks demands have gone unmet (drives escalation). */
  frustrationTicks: number;
}

/** A single policy position in an empire. */
export interface PolicyPosition {
  domain: PolicyDomain;
  /** -100 to +100 representing the current policy stance. */
  value: number;
}

/** Full political state for an empire. */
export interface EmpirePoliticalState {
  factions: PoliticalFaction[];
  policies: PolicyPosition[];
  /** How legitimate the government is perceived (0-100). */
  legitimacy: number;
  /** How corrupt the government is (0-100). */
  corruption: number;
}

/** Events emitted by political processing. */
export type PoliticalEvent =
  | FactionFormedEvent
  | FactionDissolvedEvent
  | FactionEscalatedEvent
  | FactionDeescalatedEvent
  | PolicyDriftEvent
  | CorruptionChangeEvent
  | LegitimacyChangeEvent
  | StrikeEvent
  | ProtestEvent
  | CoupAttemptEvent
  | ElectionEvent;

export interface FactionFormedEvent {
  type: 'faction_formed';
  factionId: string;
  factionName: string;
  supportBase: number;
}

export interface FactionDissolvedEvent {
  type: 'faction_dissolved';
  factionId: string;
  factionName: string;
  reason: string;
}

export interface FactionEscalatedEvent {
  type: 'faction_escalated';
  factionId: string;
  factionName: string;
  previousAction: FactionAction;
  newAction: FactionAction;
}

export interface FactionDeescalatedEvent {
  type: 'faction_deescalated';
  factionId: string;
  factionName: string;
  previousAction: FactionAction;
  newAction: FactionAction;
}

export interface PolicyDriftEvent {
  type: 'policy_drift';
  domain: PolicyDomain;
  oldValue: number;
  newValue: number;
  causedBy: string;
}

export interface CorruptionChangeEvent {
  type: 'corruption_change';
  oldValue: number;
  newValue: number;
}

export interface LegitimacyChangeEvent {
  type: 'legitimacy_change';
  oldValue: number;
  newValue: number;
}

export interface StrikeEvent {
  type: 'strike';
  factionId: string;
  factionName: string;
  /** Fraction of economic output lost (0.0-1.0). */
  economicImpact: number;
}

export interface ProtestEvent {
  type: 'protest';
  factionId: string;
  factionName: string;
  /** Happiness penalty from protests. */
  happinessImpact: number;
}

export interface CoupAttemptEvent {
  type: 'coup_attempt';
  factionId: string;
  factionName: string;
  /** Whether the coup succeeded. */
  success: boolean;
  /** Military strength of the faction relative to the government (0-1). */
  militaryStrength: number;
}

export interface ElectionEvent {
  type: 'election';
  winnerFactionId: string;
  winnerFactionName: string;
  voteShares: Array<{ factionId: string; factionName: string; share: number }>;
  wasRigged: boolean;
  riggingDetected: boolean;
}

// ---------------------------------------------------------------------------
// RNG type — callers pass a seeded RNG for determinism
// ---------------------------------------------------------------------------

/** Minimal RNG interface: returns a value in [0, 1). */
export type RNG = () => number;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum support base (fraction) before a faction dissolves. */
const DISSOLUTION_THRESHOLD = 0.05;

/** Minimum demographic segment share (fraction) to trigger faction emergence. */
const EMERGENCE_THRESHOLD = 0.15;

/** Maximum number of active (non-dissolved) factions. */
const MAX_ACTIVE_FACTIONS = 5;

/** How much satisfaction must drop before the faction considers escalating. */
const ESCALATION_SATISFACTION_THRESHOLD = -20;

/** How many consecutive frustration ticks before escalation occurs. */
const ESCALATION_FRUSTRATION_TICKS = 5;

/** Satisfaction above which a faction will de-escalate. */
const DEESCALATION_SATISFACTION_THRESHOLD = 10;

/** Base corruption for each government type. */
const GOVERNMENT_CORRUPTION_BASELINE: Partial<Record<GovernmentType, number>> = {
  democracy: 10,
  republic: 15,
  federation: 12,
  autocracy: 35,
  empire: 40,
  theocracy: 25,
  oligarchy: 45,
  military_junta: 50,
  technocracy: 15,
  hive_mind: 5,
  forced_labour: 60,
  dictatorship: 55,
  equality: 8,
  tribal_council: 20,
};

/** Government types that hold elections. */
const ELECTORAL_GOVERNMENTS = new Set<GovernmentType>([
  'democracy', 'republic', 'federation', 'equality',
]);

/** Government types where the ruling faction has extra clout. */
const AUTHORITARIAN_GOVERNMENTS = new Set<GovernmentType>([
  'autocracy', 'empire', 'dictatorship', 'military_junta', 'forced_labour',
]);

// ---------------------------------------------------------------------------
// Species starter factions — 2-3 lore-appropriate factions per species
// ---------------------------------------------------------------------------

interface StarterFactionDef {
  name: string;
  demands: PolicyDemand[];
  supportSources: FactionSupportSources;
  initialSupport: number;
  isRuling: boolean;
}

/**
 * Hardcoded starter factions per species, drawn from their lore.
 * Each species gets 2-3 factions reflecting their internal tensions.
 * Species not listed get a generic set based on government type.
 */
const SPECIES_STARTER_FACTIONS: Record<string, StarterFactionDef[]> = {
  // Vaelori: Resonants (share knowledge) vs Attenuants (hoard knowledge)
  vaelori: [
    {
      name: 'Resonant Assembly',
      demands: [
        { domain: 'foreign', value: 60 },     // Open diplomacy, share warnings
        { domain: 'education', value: 80 },    // Spread knowledge
        { domain: 'security', value: 30 },
      ],
      supportSources: { vocation: 'scientists', faith: 'secular' },
      initialSupport: 0.55,
      isRuling: true,
    },
    {
      name: 'Attenuant Conclave',
      demands: [
        { domain: 'foreign', value: -40 },     // Isolationist
        { domain: 'security', value: 80 },     // Hoard knowledge, protect secrets
        { domain: 'political', value: -30 },   // Restrict information
      ],
      supportSources: { vocation: 'administrators', loyalty: 'loyal' },
      initialSupport: 0.35,
      isRuling: false,
    },
  ],

  // Khazari: Forge-Lords (build) vs War-Speakers (conquer)
  khazari: [
    {
      name: 'Forge-Lords Guild',
      demands: [
        { domain: 'economic', value: 70 },     // Industrial output
        { domain: 'education', value: 40 },    // Apprenticeships
        { domain: 'domestic', value: 50 },     // Infrastructure
      ],
      supportSources: { vocation: 'workers' },
      initialSupport: 0.45,
      isRuling: true,
    },
    {
      name: 'War-Speakers Council',
      demands: [
        { domain: 'security', value: 80 },     // Military build-up
        { domain: 'foreign', value: -60 },     // Aggressive foreign policy
        { domain: 'economic', value: 40 },     // War economy
      ],
      supportSources: { vocation: 'military' },
      initialSupport: 0.40,
      isRuling: false,
    },
  ],

  // Nexari: The Collective (expand the Gift) vs Rememberers (investigate the Silence)
  nexari: [
    {
      name: 'The Collective Consensus',
      demands: [
        { domain: 'foreign', value: 40 },      // Diplomatic expansion
        { domain: 'political', value: 80 },    // Unity, integration
        { domain: 'education', value: 60 },    // Upgrade other species
      ],
      supportSources: { loyalty: 'loyal' },
      initialSupport: 0.70,
      isRuling: true,
    },
    {
      name: 'Rememberer Enclave',
      demands: [
        { domain: 'education', value: 80 },    // Research the Silence
        { domain: 'foreign', value: -20 },     // Cautious expansion
        { domain: 'health', value: 60 },       // Fix the broken uploads
      ],
      supportSources: { vocation: 'scientists' },
      initialSupport: 0.20,
      isRuling: false,
    },
  ],

  // Orivani: Crusaders (prepare for the Coming through strength) vs Contemplatives (prepare through wisdom)
  orivani: [
    {
      name: 'Order of the Coming',
      demands: [
        { domain: 'security', value: 70 },     // Military readiness
        { domain: 'domestic', value: 60 },     // Build temples and infrastructure
        { domain: 'foreign', value: 20 },      // Convert others
      ],
      supportSources: { faith: 'fanatics', vocation: 'military' },
      initialSupport: 0.50,
      isRuling: true,
    },
    {
      name: 'Contemplative Orders',
      demands: [
        { domain: 'education', value: 70 },    // Theological study
        { domain: 'health', value: 50 },       // Care for the faithful
        { domain: 'political', value: -20 },   // Heretical whispers about resisting the Coming
      ],
      supportSources: { faith: 'observant', vocation: 'educators' },
      initialSupport: 0.30,
      isRuling: false,
    },
    {
      name: 'Heretical Resistance',
      demands: [
        { domain: 'security', value: 80 },     // Arm against the Coming, not for it
        { domain: 'education', value: 60 },    // Question the prophecy
        { domain: 'foreign', value: 40 },      // Build alliances
      ],
      supportSources: { faith: 'secular', loyalty: 'disgruntled' },
      initialSupport: 0.10,
      isRuling: false,
    },
  ],

  // Drakmari: Abyssal Traditionalists vs Current-Riders
  drakmari: [
    {
      name: 'Abyssal Traditionalists',
      demands: [
        { domain: 'domestic', value: 60 },     // Sustainable harvesting
        { domain: 'health', value: 50 },       // Clean the oceans
        { domain: 'economic', value: -30 },    // Limit industry
      ],
      supportSources: { loyalty: 'loyal', faith: 'observant' },
      initialSupport: 0.40,
      isRuling: false,
    },
    {
      name: 'Current-Riders',
      demands: [
        { domain: 'foreign', value: 50 },      // Explore for new oceans
        { domain: 'economic', value: 60 },     // Industrialise
        { domain: 'education', value: 40 },    // Adapt
      ],
      supportSources: { vocation: 'merchants', loyalty: 'content' },
      initialSupport: 0.45,
      isRuling: true,
    },
  ],

  // Teranos: Expansionists vs Diplomats vs Isolationists
  teranos: [
    {
      name: 'Expansionist Coalition',
      demands: [
        { domain: 'foreign', value: -30 },     // Aggressive expansion
        { domain: 'security', value: 60 },     // Strong military
        { domain: 'economic', value: 50 },     // Fund the expansion
      ],
      supportSources: { vocation: 'military' },
      initialSupport: 0.35,
      isRuling: false,
    },
    {
      name: 'Diplomatic League',
      demands: [
        { domain: 'foreign', value: 70 },      // Peaceful engagement
        { domain: 'economic', value: 40 },     // Trade-focused
        { domain: 'education', value: 50 },    // Cultural exchange
      ],
      supportSources: { vocation: 'merchants', loyalty: 'content' },
      initialSupport: 0.40,
      isRuling: true,
    },
    {
      name: 'Rationalist Movement',
      demands: [
        { domain: 'education', value: 80 },    // Science first
        { domain: 'health', value: 60 },       // Welfare
        { domain: 'political', value: 40 },    // Meritocracy
      ],
      supportSources: { vocation: 'scientists', faith: 'secular' },
      initialSupport: 0.20,
      isRuling: false,
    },
  ],

  // Sylvani: Old Growth (patience) vs New Growth (urgency)
  sylvani: [
    {
      name: 'Old Growth Consensus',
      demands: [
        { domain: 'domestic', value: 60 },     // Ecosystem preservation
        { domain: 'health', value: 70 },       // Nurture the network
        { domain: 'foreign', value: 20 },      // Patient diplomacy
      ],
      supportSources: { faith: 'observant', loyalty: 'loyal' },
      initialSupport: 0.55,
      isRuling: true,
    },
    {
      name: 'New Growth Front',
      demands: [
        { domain: 'foreign', value: 50 },      // Rapid expansion to fight the Withering
        { domain: 'education', value: 60 },    // Research the Withering
        { domain: 'security', value: 40 },     // Protect colonies
      ],
      supportSources: { vocation: 'scientists', loyalty: 'disgruntled' },
      initialSupport: 0.35,
      isRuling: false,
    },
  ],

  // Vethara: Covenant (ethical bonding) vs Unbound (survival at any cost)
  vethara: [
    {
      name: 'The Covenant',
      demands: [
        { domain: 'foreign', value: 60 },      // Diplomatic bonding partnerships
        { domain: 'political', value: 50 },    // Consent frameworks
        { domain: 'health', value: 60 },       // Bonding protocols
      ],
      supportSources: { faith: 'observant', loyalty: 'content' },
      initialSupport: 0.60,
      isRuling: true,
    },
    {
      name: 'The Unbound',
      demands: [
        { domain: 'security', value: 50 },     // Protect the species
        { domain: 'foreign', value: -20 },     // Forceful expansion
        { domain: 'political', value: -40 },   // Survival trumps consent
      ],
      supportSources: { loyalty: 'disgruntled' },
      initialSupport: 0.25,
      isRuling: false,
    },
  ],

  // Kaelenth: Seekers (find the creators) vs Foundry Orthodoxy (define own purpose)
  kaelenth: [
    {
      name: 'Seeker Directorate',
      demands: [
        { domain: 'education', value: 80 },    // Archaeology and research
        { domain: 'foreign', value: 40 },      // Survey every system
        { domain: 'economic', value: 30 },     // Fund the search
      ],
      supportSources: { vocation: 'scientists' },
      initialSupport: 0.55,
      isRuling: true,
    },
    {
      name: 'Foundry Orthodoxy',
      demands: [
        { domain: 'economic', value: 70 },     // Build for building's sake
        { domain: 'domestic', value: 60 },     // Infrastructure
        { domain: 'political', value: 40 },    // Self-determination
      ],
      supportSources: { vocation: 'workers' },
      initialSupport: 0.35,
      isRuling: false,
    },
  ],

  // Ashkari: Wanderers (keep moving) vs Settlers (find a new home)
  ashkari: [
    {
      name: 'Wanderer Fleets',
      demands: [
        { domain: 'foreign', value: 50 },      // Trade everywhere
        { domain: 'economic', value: 70 },     // Profit margins
        { domain: 'security', value: 40 },     // Protect the fleet
      ],
      supportSources: { vocation: 'merchants', loyalty: 'loyal' },
      initialSupport: 0.45,
      isRuling: true,
    },
    {
      name: 'Settler Assembly',
      demands: [
        { domain: 'domestic', value: 70 },     // Build a homeworld
        { domain: 'education', value: 50 },    // Establish institutions
        { domain: 'health', value: 50 },       // Welfare for ground-side population
      ],
      supportSources: { vocation: 'workers', loyalty: 'content' },
      initialSupport: 0.35,
      isRuling: false,
    },
  ],

  // Luminari: Observers (study, don't interfere) vs Interventionists (share energy tech)
  luminari: [
    {
      name: 'Observer Concord',
      demands: [
        { domain: 'education', value: 80 },    // Study everything
        { domain: 'foreign', value: 30 },      // Watch, don't touch
        { domain: 'political', value: 40 },    // Non-interference doctrine
      ],
      supportSources: { vocation: 'scientists', faith: 'secular' },
      initialSupport: 0.50,
      isRuling: true,
    },
    {
      name: 'Interventionist Wave',
      demands: [
        { domain: 'foreign', value: 60 },      // Active engagement
        { domain: 'education', value: 70 },    // Share knowledge
        { domain: 'health', value: 50 },       // Help physical species
      ],
      supportSources: { vocation: 'educators' },
      initialSupport: 0.35,
      isRuling: false,
    },
  ],

  // Zorvathi: Hive mind — minimal internal politics but Core vs Outer Workers tension
  zorvathi: [
    {
      name: 'Core Consensus',
      demands: [
        { domain: 'domestic', value: 70 },     // Expand the tunnels
        { domain: 'economic', value: 60 },     // Resource extraction
        { domain: 'security', value: 40 },     // Protect the hive
      ],
      supportSources: { loyalty: 'loyal' },
      initialSupport: 0.75,
      isRuling: true,
    },
    {
      name: 'Outer Workers Pheromone',
      demands: [
        { domain: 'foreign', value: 40 },      // Engage with aliens
        { domain: 'education', value: 50 },    // Understand other minds
        { domain: 'political', value: 30 },    // New pheromone concepts
      ],
      supportSources: { vocation: 'merchants' },
      initialSupport: 0.15,
      isRuling: false,
    },
  ],

  // Thyriaq: Absorbers vs Boundary-recognisers
  thyriaq: [
    {
      name: 'Expansion Configuration',
      demands: [
        { domain: 'foreign', value: -40 },     // Absorb everything
        { domain: 'economic', value: 70 },     // Fill all volume
        { domain: 'domestic', value: 60 },     // Grow, grow, grow
      ],
      supportSources: { loyalty: 'loyal' },
      initialSupport: 0.60,
      isRuling: true,
    },
    {
      name: 'Boundary Resonance',
      demands: [
        { domain: 'foreign', value: 50 },      // Respect other matter
        { domain: 'political', value: 40 },    // Rights of configuration
        { domain: 'education', value: 50 },    // Understand alien minds
      ],
      supportSources: { vocation: 'scientists' },
      initialSupport: 0.25,
      isRuling: false,
    },
  ],

  // Aethyn: Pioneers (explore our universe) vs Conservators (return home)
  aethyn: [
    {
      name: 'Pioneer Expedition',
      demands: [
        { domain: 'education', value: 80 },    // Study this universe
        { domain: 'foreign', value: 50 },      // Engage with locals
        { domain: 'economic', value: 30 },     // Fund expeditions
      ],
      supportSources: { vocation: 'scientists' },
      initialSupport: 0.55,
      isRuling: true,
    },
    {
      name: 'Conservator Lattice',
      demands: [
        { domain: 'health', value: 60 },       // Prevent dimensional calcification
        { domain: 'security', value: 50 },     // Maintain the breach
        { domain: 'domestic', value: 40 },     // Preserve home dimension ties
      ],
      supportSources: { loyalty: 'loyal', faith: 'observant' },
      initialSupport: 0.35,
      isRuling: false,
    },
  ],

  // Pyrenth: Deep Masons (patience, perfection) vs Surface Shapers (act now)
  pyrenth: [
    {
      name: 'Deep Mason Synod',
      demands: [
        { domain: 'domestic', value: 80 },     // Perfect the homeworld
        { domain: 'economic', value: 50 },     // Gather the finest minerals
        { domain: 'education', value: 40 },    // Geological mastery
      ],
      supportSources: { loyalty: 'loyal', vocation: 'workers' },
      initialSupport: 0.50,
      isRuling: true,
    },
    {
      name: 'Surface Shapers',
      demands: [
        { domain: 'foreign', value: -30 },     // Claim worlds quickly
        { domain: 'security', value: 60 },     // Defend claimed worlds
        { domain: 'economic', value: 60 },     // Rapid resource extraction
      ],
      supportSources: { vocation: 'military', loyalty: 'disgruntled' },
      initialSupport: 0.35,
      isRuling: false,
    },
  ],
};

// ---------------------------------------------------------------------------
// Public: initialisePoliticalState
// ---------------------------------------------------------------------------

/**
 * Create the initial political state for a newly formed empire.
 *
 * Generates 2-3 species-specific starter factions drawn from the species' lore,
 * sets baseline policies at neutral, and initialises legitimacy/corruption
 * based on government type.
 *
 * @param empireId       The empire this state belongs to.
 * @param speciesId      Species identifier — determines starter factions.
 * @param governmentType The empire's form of government.
 * @param tick           The current game tick (used as foundedTick).
 * @returns A fully populated EmpirePoliticalState.
 */
export function initialisePoliticalState(
  empireId: string,
  speciesId: string,
  governmentType: GovernmentType,
  tick: number,
): EmpirePoliticalState {
  const starterDefs = SPECIES_STARTER_FACTIONS[speciesId]
    ?? getGenericStarterFactions(governmentType);

  const factions: PoliticalFaction[] = starterDefs.map((def) => ({
    id: `${empireId}-fac-${generateId()}`,
    name: def.name,
    speciesOrigin: speciesId,
    supportBase: def.initialSupport,
    clout: def.isRuling ? 1.0 : 0.5,
    satisfaction: 0, // Neutral at start
    demands: [...def.demands],
    currentAction: 'lobbying' as FactionAction,
    isRulingFaction: def.isRuling,
    foundedTick: tick,
    dissolved: false,
    supportSources: { ...def.supportSources },
    frustrationTicks: 0,
  }));

  // Neutral policies to start
  const policies: PolicyPosition[] = ALL_POLICY_DOMAINS.map((domain) => ({
    domain,
    value: 0,
  }));

  const baseLegitimacy = ELECTORAL_GOVERNMENTS.has(governmentType) ? 70 : 50;
  const baseCorruption = GOVERNMENT_CORRUPTION_BASELINE[governmentType] ?? 20;

  return {
    factions,
    policies,
    legitimacy: baseLegitimacy,
    corruption: baseCorruption,
  };
}

// ---------------------------------------------------------------------------
// Public: processPoliticalTick
// ---------------------------------------------------------------------------

/**
 * Advance the political state by one tick.
 *
 * This handles:
 *  a. Updating faction support from demographics
 *  b. Checking faction satisfaction against current policies
 *  c. Escalating / de-escalating faction actions based on satisfaction
 *  d. Checking for new faction emergence
 *  e. Checking for faction dissolution
 *  f. Processing corruption drift
 *  g. Processing legitimacy changes
 *
 * @param state          Current political state.
 * @param demographics   Aggregated demographics across the empire's planets.
 * @param governmentType The empire's form of government.
 * @param tick           Current game tick.
 * @param rng            Seeded random number generator.
 * @returns New state and any events generated.
 */
export function processPoliticalTick(
  state: EmpirePoliticalState,
  demographics: PlanetDemographics,
  governmentType: GovernmentType,
  tick: number,
  rng: RNG,
): { state: EmpirePoliticalState; events: PoliticalEvent[] } {
  const events: PoliticalEvent[] = [];
  let factions = state.factions.map((f) => ({ ...f, demands: [...f.demands] }));
  let policies = state.policies.map((p) => ({ ...p }));
  let { legitimacy, corruption } = state;

  // --- a. Update faction support from demographics ---
  factions = updateFactionSupport(factions, demographics);

  // --- b. Check faction satisfaction against policies ---
  factions = updateFactionSatisfaction(factions, policies);

  // --- c. Escalate / de-escalate faction actions ---
  const escalationResult = processEscalation(factions, rng);
  factions = escalationResult.factions;
  events.push(...escalationResult.events);

  // --- d. Process faction actions (lobbying, strikes, etc.) ---
  for (const faction of factions) {
    if (faction.dissolved) continue;
    const actionResult = processFactionAction(
      faction,
      { factions, policies, legitimacy, corruption },
      rng,
    );
    policies = actionResult.state.policies;
    legitimacy = actionResult.state.legitimacy;
    corruption = actionResult.state.corruption;
    events.push(...actionResult.events);
  }

  // --- e. Check for new faction emergence ---
  const emergenceResult = checkFactionEmergence(factions, demographics, tick, rng);
  factions = emergenceResult.factions;
  events.push(...emergenceResult.events);

  // --- f. Check for faction dissolution ---
  const dissolutionResult = checkFactionDissolution(factions);
  factions = dissolutionResult.factions;
  events.push(...dissolutionResult.events);

  // --- g. Process corruption drift ---
  const newCorruption = calculateCorruption(
    { factions, policies, legitimacy, corruption },
    demographics,
    governmentType,
    1, // Single planet — callers should provide real count
  );
  if (Math.abs(newCorruption - corruption) > 0.5) {
    const corruptionDrift = clamp(newCorruption - corruption, -2, 2);
    const oldCorruption = corruption;
    corruption = clamp(corruption + corruptionDrift, 0, 100);
    if (Math.abs(corruption - oldCorruption) > 0.1) {
      events.push({
        type: 'corruption_change',
        oldValue: round2(oldCorruption),
        newValue: round2(corruption),
      });
    }
  }

  // --- h. Process legitimacy changes ---
  const oldLegitimacy = legitimacy;
  legitimacy = updateLegitimacy(legitimacy, factions, corruption, governmentType);
  if (Math.abs(legitimacy - oldLegitimacy) > 0.1) {
    events.push({
      type: 'legitimacy_change',
      oldValue: round2(oldLegitimacy),
      newValue: round2(legitimacy),
    });
  }

  // Normalise support bases so they sum to at most 1.0
  factions = normaliseSupportBases(factions);

  return {
    state: { factions, policies, legitimacy: round2(legitimacy), corruption: round2(corruption) },
    events,
  };
}

// ---------------------------------------------------------------------------
// Public: processFactionAction
// ---------------------------------------------------------------------------

/**
 * Resolve a single faction's current action against the political state.
 *
 * @param faction  The faction taking action.
 * @param state    Current political state.
 * @param rng      Seeded random number generator.
 * @returns Updated state and events.
 */
export function processFactionAction(
  faction: PoliticalFaction,
  state: EmpirePoliticalState,
  rng: RNG,
): { state: EmpirePoliticalState; events: PoliticalEvent[] } {
  if (faction.dissolved) return { state, events: [] };

  const events: PoliticalEvent[] = [];
  let policies = state.policies.map((p) => ({ ...p }));
  let { legitimacy, corruption } = state;

  const influence = faction.supportBase * faction.clout;

  switch (faction.currentAction) {
    case 'lobbying': {
      // Slow policy drift toward faction demands
      policies = applyPolicyDrift(policies, faction.demands, influence * 0.5, faction.name, events);
      break;
    }

    case 'funding': {
      // Faster policy drift + slight corruption increase
      policies = applyPolicyDrift(policies, faction.demands, influence * 1.2, faction.name, events);
      corruption = clamp(corruption + influence * 1.5, 0, 100);
      break;
    }

    case 'strikes': {
      // Economic output reduction + public pressure
      const economicImpact = influence * 0.3;
      policies = applyPolicyDrift(policies, faction.demands, influence * 0.8, faction.name, events);
      legitimacy = clamp(legitimacy - influence * 3, 0, 100);
      events.push({
        type: 'strike',
        factionId: faction.id,
        factionName: faction.name,
        economicImpact: round2(economicImpact),
      });
      break;
    }

    case 'protests': {
      // Happiness reduction + diplomatic visibility + legitimacy hit
      const happinessImpact = influence * 5;
      policies = applyPolicyDrift(policies, faction.demands, influence * 0.6, faction.name, events);
      legitimacy = clamp(legitimacy - influence * 5, 0, 100);
      events.push({
        type: 'protest',
        factionId: faction.id,
        factionName: faction.name,
        happinessImpact: round2(happinessImpact),
      });
      break;
    }

    case 'coup': {
      // Revolution check — escalating probability based on frustration
      const result = processCoupAttempt(faction, state, rng);
      legitimacy = result.legitimacy;
      events.push(...result.events);
      break;
    }
  }

  return {
    state: {
      ...state,
      policies,
      legitimacy: clamp(legitimacy, 0, 100),
      corruption: clamp(corruption, 0, 100),
    },
    events,
  };
}

// ---------------------------------------------------------------------------
// Public: processElection
// ---------------------------------------------------------------------------

/**
 * Run an election cycle. Calculates vote shares from faction support,
 * determines a winner, and optionally handles election rigging.
 *
 * Only meaningful for electoral government types (democracy, republic,
 * federation, equality). Other government types should not call this.
 *
 * @param state        Current political state.
 * @param demographics Empire demographics (affects voting patterns).
 * @param rng          Seeded random number generator.
 * @returns Updated state and election events.
 */
export function processElection(
  state: EmpirePoliticalState,
  demographics: PlanetDemographics,
  rng: RNG,
): { state: EmpirePoliticalState; events: PoliticalEvent[] } {
  const events: PoliticalEvent[] = [];
  const activeFactions = state.factions.filter((f) => !f.dissolved);

  if (activeFactions.length === 0) return { state, events };

  // Calculate raw vote shares based on support + clout
  const rawShares = activeFactions.map((f) => ({
    faction: f,
    rawVote: f.supportBase * (0.5 + f.clout * 0.5),
  }));

  const totalRawVotes = rawShares.reduce((s, v) => s + v.rawVote, 0);

  // Apply loyalty modifier — loyal populations favour the ruling faction
  const loyaltyBonus = demographics.loyalty.loyal / Math.max(1, demographics.totalPopulation);
  const adjustedShares = rawShares.map((v) => {
    const loyaltyMod = v.faction.isRulingFaction ? (1 + loyaltyBonus * 0.3) : 1;
    return {
      faction: v.faction,
      vote: (v.rawVote / Math.max(0.01, totalRawVotes)) * loyaltyMod,
    };
  });

  // Check for election rigging (high corruption = chance of rigging)
  const wasRigged = state.corruption > 40 && rng() < (state.corruption / 200);
  let riggingDetected = false;

  if (wasRigged) {
    // Ruling faction gets a boost from rigging
    const rulingFaction = adjustedShares.find((v) => v.faction.isRulingFaction);
    if (rulingFaction) {
      rulingFaction.vote *= 1.3;
    }
    // Detection chance scales with how blatant the rigging is
    riggingDetected = rng() < (state.corruption / 150);
  }

  // Normalise shares to sum to 1.0
  const totalAdjusted = adjustedShares.reduce((s, v) => s + v.vote, 0);
  const normalisedShares = adjustedShares.map((v) => ({
    ...v,
    share: totalAdjusted > 0 ? v.vote / totalAdjusted : 1 / adjustedShares.length,
  }));

  // Add random noise for election uncertainty
  const noisyShares = normalisedShares.map((v) => ({
    ...v,
    share: Math.max(0, v.share + (rng() - 0.5) * 0.05),
  }));

  // Determine winner — highest vote share
  const winner = noisyShares.reduce(
    (best, current) => (current.share > best.share ? current : best),
    noisyShares[0],
  );

  // Update faction ruling status
  const factions = state.factions.map((f) => ({
    ...f,
    demands: [...f.demands],
    isRulingFaction: f.id === winner.faction.id,
    // Winner gets a clout boost; losers lose a bit
    clout: f.id === winner.faction.id
      ? clamp(f.clout + 0.2, 0.1, 2.0)
      : clamp(f.clout - 0.05, 0.1, 2.0),
  }));

  let { legitimacy } = state;

  if (riggingDetected) {
    legitimacy = clamp(legitimacy - 15, 0, 100);
  } else if (!wasRigged) {
    // Fair election boosts legitimacy
    legitimacy = clamp(legitimacy + 5, 0, 100);
  }

  events.push({
    type: 'election',
    winnerFactionId: winner.faction.id,
    winnerFactionName: winner.faction.name,
    voteShares: noisyShares.map((v) => ({
      factionId: v.faction.id,
      factionName: v.faction.name,
      share: round2(v.share),
    })),
    wasRigged,
    riggingDetected,
  });

  return {
    state: {
      ...state,
      factions,
      legitimacy: round2(legitimacy),
    },
    events,
  };
}

// ---------------------------------------------------------------------------
// Public: calculateCorruption
// ---------------------------------------------------------------------------

/**
 * Calculate the equilibrium corruption level for an empire based on
 * structural factors.
 *
 * Corruption is driven by:
 *  - Government type baseline (authoritarian → higher baseline)
 *  - Inequality (wealth distribution skew in demographics)
 *  - Enforcement (security and political policy positions)
 *  - Empire size (more planets → harder to monitor)
 *  - Foreign interference (placeholder for espionage integration)
 *
 * @param state             Current political state.
 * @param demographics      Empire demographics.
 * @param governmentType    The empire's government type.
 * @param empirePlanetCount Number of colonised planets.
 * @returns Target corruption level (0-100).
 */
export function calculateCorruption(
  state: EmpirePoliticalState,
  demographics: PlanetDemographics,
  governmentType: GovernmentType,
  empirePlanetCount: number,
): number {
  // 1. Government type baseline
  const baseline = GOVERNMENT_CORRUPTION_BASELINE[governmentType] ?? 20;

  // 2. Inequality factor — proxy via loyalty distribution
  // A highly unequal society (many disgruntled/rebellious) breeds corruption
  const totalPop = Math.max(1, demographics.totalPopulation);
  const discontentRatio =
    (demographics.loyalty.disgruntled + demographics.loyalty.rebellious) / totalPop;
  const inequalityFactor = discontentRatio * 30; // 0-30 range

  // 3. Enforcement factor — strong political/security policies reduce corruption
  const securityPolicy = state.policies.find((p) => p.domain === 'security')?.value ?? 0;
  const politicalPolicy = state.policies.find((p) => p.domain === 'political')?.value ?? 0;
  // Positive values = stronger enforcement = less corruption
  const enforcementReduction = ((securityPolicy + politicalPolicy) / 200) * 15; // -15 to +15

  // 4. Empire size — larger empires are harder to monitor
  const sizeFactor = Math.min(20, Math.log2(Math.max(1, empirePlanetCount)) * 5);

  // 5. Legitimacy inversely affects corruption
  const legitimacyReduction = (state.legitimacy / 100) * 10; // 0-10

  // 6. Education reduces corruption (informed populace)
  const educationReduction = (demographics.educationLevel / 100) * 10; // 0-10

  const result = baseline
    + inequalityFactor
    - enforcementReduction
    + sizeFactor
    - legitimacyReduction
    - educationReduction;

  return clamp(result, 0, 100);
}

// ---------------------------------------------------------------------------
// Helpers: faction support from demographics
// ---------------------------------------------------------------------------

/**
 * Update faction support bases using demographic data.
 *
 * Mapping logic:
 *  - military vocation → militarist / security-focused factions
 *  - fanatics / observant faith → religious factions
 *  - scientists → education / research factions
 *  - merchants → economic / trade factions
 *  - disgruntled / rebellious loyalty → opposition factions
 */
function updateFactionSupport(
  factions: PoliticalFaction[],
  demographics: PlanetDemographics,
): PoliticalFaction[] {
  const totalPop = Math.max(1, demographics.totalPopulation);
  const workingPop = Math.max(1, demographics.vocations.scientists
    + demographics.vocations.workers
    + demographics.vocations.military
    + demographics.vocations.merchants
    + demographics.vocations.administrators
    + demographics.vocations.educators
    + demographics.vocations.medical
    + demographics.vocations.general);

  return factions.map((faction) => {
    if (faction.dissolved) return faction;

    let demographicSupport = 0;
    let sourceCount = 0;

    const src = faction.supportSources;

    // Vocation-based support
    if (src.vocation) {
      const vocationKey = src.vocation as keyof typeof demographics.vocations;
      const vocationPop = demographics.vocations[vocationKey] ?? 0;
      demographicSupport += vocationPop / workingPop;
      sourceCount++;
    }

    // Faith-based support
    if (src.faith) {
      const faithKey = src.faith as keyof typeof demographics.faith;
      const faithPop = demographics.faith[faithKey] ?? 0;
      demographicSupport += faithPop / totalPop;
      sourceCount++;
    }

    // Loyalty-based support
    if (src.loyalty) {
      const loyaltyKey = src.loyalty as keyof typeof demographics.loyalty;
      const loyaltyPop = demographics.loyalty[loyaltyKey] ?? 0;
      demographicSupport += loyaltyPop / totalPop;
      sourceCount++;
    }

    if (sourceCount > 0) {
      demographicSupport /= sourceCount;
    }

    // Blend old support with demographic signal (slow drift, not instant snap)
    const blendRate = 0.1; // 10% drift per tick toward demographic reality
    const newSupport = faction.supportBase * (1 - blendRate) + demographicSupport * blendRate;

    return {
      ...faction,
      supportBase: clamp(newSupport, 0, 1),
    };
  });
}

// ---------------------------------------------------------------------------
// Helpers: satisfaction
// ---------------------------------------------------------------------------

/** Calculate how satisfied each faction is with current policies. */
function updateFactionSatisfaction(
  factions: PoliticalFaction[],
  policies: PolicyPosition[],
): PoliticalFaction[] {
  const policyMap = new Map(policies.map((p) => [p.domain, p.value]));

  return factions.map((faction) => {
    if (faction.dissolved) return faction;

    // Satisfaction = how close current policies are to the faction's demands
    let totalAlignment = 0;
    let demandCount = 0;

    for (const demand of faction.demands) {
      const currentValue = policyMap.get(demand.domain) ?? 0;
      // Distance ranges from 0 (perfect match) to 200 (polar opposite)
      const distance = Math.abs(currentValue - demand.value);
      // Convert to satisfaction: 0 distance = +50, 200 distance = -50
      const alignment = 50 - (distance / 2);
      totalAlignment += alignment;
      demandCount++;
    }

    const satisfaction = demandCount > 0 ? totalAlignment / demandCount : 0;

    // Ruling factions get a satisfaction bonus (they have power)
    const rulingBonus = faction.isRulingFaction ? 15 : 0;

    return {
      ...faction,
      satisfaction: clamp(satisfaction + rulingBonus, -100, 100),
    };
  });
}

// ---------------------------------------------------------------------------
// Helpers: escalation / de-escalation
// ---------------------------------------------------------------------------

/**
 * Process the escalation ladder for all factions.
 *
 * Factions do not jump from lobbying to coup — they move one step at a time
 * along the escalation ladder, driven by sustained frustration. They also
 * de-escalate when their demands start being met.
 */
function processEscalation(
  factions: PoliticalFaction[],
  rng: RNG,
): { factions: PoliticalFaction[]; events: PoliticalEvent[] } {
  const events: PoliticalEvent[] = [];

  const updated = factions.map((faction) => {
    if (faction.dissolved) return faction;

    const currentIdx = ESCALATION_LADDER.indexOf(faction.currentAction);

    // Check for de-escalation: satisfaction above threshold
    if (faction.satisfaction > DEESCALATION_SATISFACTION_THRESHOLD && currentIdx > 0) {
      // De-escalate one step (with some inertia — 30% chance per tick)
      if (rng() < 0.30) {
        const previousAction = faction.currentAction;
        const newAction = ESCALATION_LADDER[currentIdx - 1];
        events.push({
          type: 'faction_deescalated',
          factionId: faction.id,
          factionName: faction.name,
          previousAction,
          newAction,
        });
        return {
          ...faction,
          currentAction: newAction,
          frustrationTicks: 0,
        };
      }
      return { ...faction, frustrationTicks: 0 };
    }

    // Check for escalation: satisfaction below threshold
    if (faction.satisfaction < ESCALATION_SATISFACTION_THRESHOLD) {
      const newFrustrationTicks = faction.frustrationTicks + 1;

      if (newFrustrationTicks >= ESCALATION_FRUSTRATION_TICKS && currentIdx < ESCALATION_LADDER.length - 1) {
        // Escalation probability increases with frustration but is never guaranteed
        // This creates an escalating probability model rather than a hard threshold
        const escalationProbability = Math.min(0.5, 0.1 + (newFrustrationTicks - ESCALATION_FRUSTRATION_TICKS) * 0.05);

        if (rng() < escalationProbability) {
          const previousAction = faction.currentAction;
          const newAction = ESCALATION_LADDER[currentIdx + 1];
          events.push({
            type: 'faction_escalated',
            factionId: faction.id,
            factionName: faction.name,
            previousAction,
            newAction,
          });
          return {
            ...faction,
            currentAction: newAction,
            frustrationTicks: 0, // Reset after escalation
          };
        }
      }

      return { ...faction, frustrationTicks: newFrustrationTicks };
    }

    // Satisfaction is neutral — slowly cool frustration
    return {
      ...faction,
      frustrationTicks: Math.max(0, faction.frustrationTicks - 1),
    };
  });

  return { factions: updated, events };
}

// ---------------------------------------------------------------------------
// Helpers: coup attempt
// ---------------------------------------------------------------------------

/**
 * Process a coup attempt with escalating probability.
 *
 * The coup does not automatically succeed or fail — it is a roll of
 * military strength vs government strength, with the probability of
 * success increasing each tick the faction remains in coup mode.
 */
function processCoupAttempt(
  faction: PoliticalFaction,
  state: EmpirePoliticalState,
  rng: RNG,
): { legitimacy: number; events: PoliticalEvent[] } {
  const events: PoliticalEvent[] = [];

  // Faction's military strength — influenced by support among military vocation
  // and the faction's overall clout
  const factionStrength = faction.supportBase * faction.clout;

  // Government strength — the ruling faction's clout + legitimacy
  const rulingFaction = state.factions.find((f) => f.isRulingFaction && !f.dissolved);
  const governmentStrength = rulingFaction
    ? rulingFaction.clout * (state.legitimacy / 100)
    : state.legitimacy / 100;

  // Base coup success probability: starts at 1% and increases by 1% each frustration tick
  // This creates the escalating probability model: 1%, 2%, 3%, 4%...
  const baseProbability = 0.01 + faction.frustrationTicks * 0.01;

  // Modify by relative strength
  const strengthRatio = factionStrength / Math.max(0.1, governmentStrength);
  const coupProbability = clamp(baseProbability * strengthRatio, 0, 0.5);

  const success = rng() < coupProbability;

  let legitimacy = state.legitimacy;

  if (success) {
    // Coup succeeds — massive legitimacy hit
    legitimacy = clamp(legitimacy - 40, 0, 100);
  } else {
    // Failed coup — moderate legitimacy hit (instability is visible)
    legitimacy = clamp(legitimacy - 10, 0, 100);
  }

  events.push({
    type: 'coup_attempt',
    factionId: faction.id,
    factionName: faction.name,
    success,
    militaryStrength: round2(factionStrength),
  });

  return { legitimacy, events };
}

// ---------------------------------------------------------------------------
// Helpers: faction emergence and dissolution
// ---------------------------------------------------------------------------

/**
 * Check whether any unrepresented demographic segment is large enough
 * to spawn a new faction.
 *
 * A new faction emerges when a demographic segment exceeds 15% of the
 * population and no existing faction draws support from that segment.
 */
function checkFactionEmergence(
  factions: PoliticalFaction[],
  demographics: PlanetDemographics,
  tick: number,
  rng: RNG,
): { factions: PoliticalFaction[]; events: PoliticalEvent[] } {
  const events: PoliticalEvent[] = [];
  const activeFactions = factions.filter((f) => !f.dissolved);

  // Don't exceed the maximum active factions
  if (activeFactions.length >= MAX_ACTIVE_FACTIONS) {
    return { factions, events };
  }

  const totalPop = Math.max(1, demographics.totalPopulation);

  // Check demographic segments for unrepresented groups

  // 1. Military vocation segment
  const militaryRatio = demographics.vocations.military /
    Math.max(1, demographics.age.workingAge);
  if (militaryRatio > EMERGENCE_THRESHOLD
    && !activeFactions.some((f) => f.supportSources.vocation === 'military')) {
    if (rng() < 0.3) { // 30% chance per tick when conditions are met
      const newFaction = createEmergentFaction(
        'Militarist Movement',
        { vocation: 'military' },
        [
          { domain: 'security', value: 70 },
          { domain: 'foreign', value: -30 },
        ],
        militaryRatio * 0.5,
        tick,
        factions,
      );
      factions = [...factions, newFaction];
      events.push({
        type: 'faction_formed',
        factionId: newFaction.id,
        factionName: newFaction.name,
        supportBase: round2(newFaction.supportBase),
      });
    }
  }

  // 2. Religious fanatics segment
  const fanaticRatio = (demographics.faith.fanatics + demographics.faith.observant) / totalPop;
  if (fanaticRatio > EMERGENCE_THRESHOLD
    && !activeFactions.some((f) => f.supportSources.faith === 'fanatics' || f.supportSources.faith === 'observant')
    && activeFactions.length < MAX_ACTIVE_FACTIONS) {
    if (rng() < 0.25) {
      const newFaction = createEmergentFaction(
        'Religious Revival',
        { faith: 'fanatics' },
        [
          { domain: 'political', value: -40 },
          { domain: 'education', value: -20 },
          { domain: 'health', value: 30 },
        ],
        fanaticRatio * 0.4,
        tick,
        factions,
      );
      factions = [...factions, newFaction];
      events.push({
        type: 'faction_formed',
        factionId: newFaction.id,
        factionName: newFaction.name,
        supportBase: round2(newFaction.supportBase),
      });
    }
  }

  // 3. Secular / scientific segment
  const secularRatio = demographics.faith.secular / totalPop;
  const scientistRatio = demographics.vocations.scientists /
    Math.max(1, demographics.age.workingAge);
  if ((secularRatio > EMERGENCE_THRESHOLD || scientistRatio > EMERGENCE_THRESHOLD)
    && !activeFactions.some((f) => f.supportSources.faith === 'secular' || f.supportSources.vocation === 'scientists')
    && activeFactions.length < MAX_ACTIVE_FACTIONS) {
    if (rng() < 0.25) {
      const newFaction = createEmergentFaction(
        'Progressive Rationalists',
        { faith: 'secular', vocation: 'scientists' },
        [
          { domain: 'education', value: 80 },
          { domain: 'political', value: 50 },
          { domain: 'health', value: 40 },
        ],
        Math.max(secularRatio, scientistRatio) * 0.4,
        tick,
        factions,
      );
      factions = [...factions, newFaction];
      events.push({
        type: 'faction_formed',
        factionId: newFaction.id,
        factionName: newFaction.name,
        supportBase: round2(newFaction.supportBase),
      });
    }
  }

  // 4. Disgruntled / rebellious populace
  const rebelliousRatio =
    (demographics.loyalty.disgruntled + demographics.loyalty.rebellious) / totalPop;
  if (rebelliousRatio > EMERGENCE_THRESHOLD
    && !activeFactions.some((f) => f.supportSources.loyalty === 'disgruntled' || f.supportSources.loyalty === 'rebellious')
    && activeFactions.length < MAX_ACTIVE_FACTIONS) {
    if (rng() < 0.2) {
      const newFaction = createEmergentFaction(
        'Reform Movement',
        { loyalty: 'disgruntled' },
        [
          { domain: 'political', value: 60 },
          { domain: 'economic', value: 40 },
          { domain: 'domestic', value: 50 },
        ],
        rebelliousRatio * 0.5,
        tick,
        factions,
      );
      factions = [...factions, newFaction];
      events.push({
        type: 'faction_formed',
        factionId: newFaction.id,
        factionName: newFaction.name,
        supportBase: round2(newFaction.supportBase),
      });
    }
  }

  // 5. Merchant / economic segment
  const merchantRatio = demographics.vocations.merchants /
    Math.max(1, demographics.age.workingAge);
  if (merchantRatio > EMERGENCE_THRESHOLD
    && !activeFactions.some((f) => f.supportSources.vocation === 'merchants')
    && activeFactions.length < MAX_ACTIVE_FACTIONS) {
    if (rng() < 0.25) {
      const newFaction = createEmergentFaction(
        'Trade Guild',
        { vocation: 'merchants' },
        [
          { domain: 'economic', value: 70 },
          { domain: 'foreign', value: 50 },
        ],
        merchantRatio * 0.5,
        tick,
        factions,
      );
      factions = [...factions, newFaction];
      events.push({
        type: 'faction_formed',
        factionId: newFaction.id,
        factionName: newFaction.name,
        supportBase: round2(newFaction.supportBase),
      });
    }
  }

  return { factions, events };
}

/** Create a new emergent faction. */
function createEmergentFaction(
  name: string,
  supportSources: FactionSupportSources,
  demands: PolicyDemand[],
  initialSupport: number,
  tick: number,
  existingFactions: PoliticalFaction[],
): PoliticalFaction {
  // Ensure we don't reuse an existing faction's ID prefix
  const id = `emergent-fac-${generateId()}`;

  return {
    id,
    name,
    supportBase: clamp(initialSupport, 0.05, 0.5),
    clout: 0.3, // Emergent factions start with low clout
    satisfaction: -10, // Slightly dissatisfied (that's why they formed)
    demands,
    currentAction: 'lobbying',
    isRulingFaction: false,
    foundedTick: tick,
    dissolved: false,
    supportSources,
    frustrationTicks: 0,
  };
}

/**
 * Dissolve factions whose support has dropped below the threshold.
 */
function checkFactionDissolution(
  factions: PoliticalFaction[],
): { factions: PoliticalFaction[]; events: PoliticalEvent[] } {
  const events: PoliticalEvent[] = [];

  const updated = factions.map((faction) => {
    if (faction.dissolved) return faction;

    // Never dissolve the ruling faction
    if (faction.isRulingFaction) return faction;

    if (faction.supportBase < DISSOLUTION_THRESHOLD) {
      events.push({
        type: 'faction_dissolved',
        factionId: faction.id,
        factionName: faction.name,
        reason: 'Support base dropped below minimum threshold',
      });
      return { ...faction, dissolved: true };
    }

    return faction;
  });

  return { factions: updated, events };
}

// ---------------------------------------------------------------------------
// Helpers: policy drift
// ---------------------------------------------------------------------------

/**
 * Apply policy drift toward a set of demands, scaled by influence.
 *
 * @param policies   Current policy positions.
 * @param demands    The faction's desired positions.
 * @param influence  How strongly the faction can push (0-1 typically).
 * @param causedBy   Name of the faction causing the drift (for events).
 * @param events     Event array to push drift events into.
 * @returns Updated policies.
 */
function applyPolicyDrift(
  policies: PolicyPosition[],
  demands: PolicyDemand[],
  influence: number,
  causedBy: string,
  events: PoliticalEvent[],
): PolicyPosition[] {
  const demandMap = new Map(demands.map((d) => [d.domain, d.value]));

  return policies.map((policy) => {
    const targetValue = demandMap.get(policy.domain);
    if (targetValue === undefined) return policy;

    const direction = targetValue > policy.value ? 1 : targetValue < policy.value ? -1 : 0;
    const driftAmount = direction * influence * 2; // Scale drift by influence

    const newValue = clamp(policy.value + driftAmount, -100, 100);

    // Only emit event if drift is noticeable
    if (Math.abs(newValue - policy.value) > 0.5) {
      events.push({
        type: 'policy_drift',
        domain: policy.domain,
        oldValue: round2(policy.value),
        newValue: round2(newValue),
        causedBy,
      });
    }

    return { ...policy, value: newValue };
  });
}

// ---------------------------------------------------------------------------
// Helpers: legitimacy
// ---------------------------------------------------------------------------

/** Update legitimacy based on faction activity, corruption, and government type. */
function updateLegitimacy(
  current: number,
  factions: PoliticalFaction[],
  corruption: number,
  governmentType: GovernmentType,
): number {
  let legitimacy = current;

  // High corruption erodes legitimacy
  if (corruption > 50) {
    legitimacy -= (corruption - 50) * 0.02;
  }

  // Factions at protest/coup level erode legitimacy
  const activeProtesters = factions.filter(
    (f) => !f.dissolved && (f.currentAction === 'protests' || f.currentAction === 'coup'),
  );
  for (const f of activeProtesters) {
    legitimacy -= f.supportBase * 2;
  }

  // High overall satisfaction boosts legitimacy
  const avgSatisfaction = getAverageWeightedSatisfaction(factions);
  if (avgSatisfaction > 20) {
    legitimacy += 0.5;
  } else if (avgSatisfaction < -20) {
    legitimacy -= 0.5;
  }

  // Authoritarian governments slowly lose legitimacy without active repression
  if (AUTHORITARIAN_GOVERNMENTS.has(governmentType)) {
    legitimacy -= 0.1; // Slow erosion unless propped up by force
  }

  // Natural recovery toward baseline if nothing is wrong
  const baselineLegitimacy = ELECTORAL_GOVERNMENTS.has(governmentType) ? 65 : 45;
  if (Math.abs(legitimacy - baselineLegitimacy) > 1) {
    legitimacy += (baselineLegitimacy - legitimacy) * 0.01; // Slow drift toward baseline
  }

  return clamp(legitimacy, 0, 100);
}

// ---------------------------------------------------------------------------
// Helpers: generic starter factions for unknown species
// ---------------------------------------------------------------------------

/** Generate generic starter factions when no species-specific ones exist. */
function getGenericStarterFactions(governmentType: GovernmentType): StarterFactionDef[] {
  if (AUTHORITARIAN_GOVERNMENTS.has(governmentType)) {
    return [
      {
        name: 'Ruling Elite',
        demands: [
          { domain: 'security', value: 60 },
          { domain: 'political', value: -40 },
          { domain: 'economic', value: 50 },
        ],
        supportSources: { loyalty: 'loyal', vocation: 'military' },
        initialSupport: 0.55,
        isRuling: true,
      },
      {
        name: 'Popular Opposition',
        demands: [
          { domain: 'political', value: 60 },
          { domain: 'domestic', value: 50 },
          { domain: 'health', value: 40 },
        ],
        supportSources: { loyalty: 'disgruntled' },
        initialSupport: 0.30,
        isRuling: false,
      },
    ];
  }

  if (governmentType === 'theocracy') {
    return [
      {
        name: 'Faithful Majority',
        demands: [
          { domain: 'political', value: -30 },
          { domain: 'education', value: -20 },
          { domain: 'domestic', value: 50 },
        ],
        supportSources: { faith: 'fanatics' },
        initialSupport: 0.55,
        isRuling: true,
      },
      {
        name: 'Secular Reformists',
        demands: [
          { domain: 'education', value: 60 },
          { domain: 'political', value: 50 },
          { domain: 'economic', value: 40 },
        ],
        supportSources: { faith: 'secular' },
        initialSupport: 0.25,
        isRuling: false,
      },
    ];
  }

  // Default: democratic-style
  return [
    {
      name: 'Governing Party',
      demands: [
        { domain: 'economic', value: 40 },
        { domain: 'education', value: 40 },
        { domain: 'domestic', value: 40 },
      ],
      supportSources: { loyalty: 'content' },
      initialSupport: 0.45,
      isRuling: true,
    },
    {
      name: 'Loyal Opposition',
      demands: [
        { domain: 'political', value: 50 },
        { domain: 'health', value: 50 },
        { domain: 'foreign', value: 30 },
      ],
      supportSources: { loyalty: 'disgruntled' },
      initialSupport: 0.35,
      isRuling: false,
    },
  ];
}

// ---------------------------------------------------------------------------
// Helpers: normalisation & utility
// ---------------------------------------------------------------------------

/** Ensure faction support bases don't exceed 1.0 in total. */
function normaliseSupportBases(factions: PoliticalFaction[]): PoliticalFaction[] {
  const active = factions.filter((f) => !f.dissolved);
  const totalSupport = active.reduce((s, f) => s + f.supportBase, 0);

  if (totalSupport <= 1.0) return factions;

  const scale = 1.0 / totalSupport;
  return factions.map((f) =>
    f.dissolved ? f : { ...f, supportBase: round2(f.supportBase * scale) },
  );
}

/** Weighted average satisfaction across active factions, weighted by support. */
function getAverageWeightedSatisfaction(factions: PoliticalFaction[]): number {
  const active = factions.filter((f) => !f.dissolved);
  if (active.length === 0) return 0;

  const totalWeight = active.reduce((s, f) => s + f.supportBase, 0);
  if (totalWeight <= 0) return 0;

  const weightedSum = active.reduce((s, f) => s + f.satisfaction * f.supportBase, 0);
  return weightedSum / totalWeight;
}

/** Clamp a value between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Round to 2 decimal places. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
