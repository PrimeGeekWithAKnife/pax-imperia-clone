/**
 * Species Psychology Type System
 *
 * Grounded in validated personality psychology: Big Five + HEXACO,
 * Attachment Theory, Enneagram, Dark Triad/Tetrad, Moral Foundations.
 *
 * Design principles:
 *  - Probabilistic, not deterministic — moods and decisions are weighted rolls
 *  - Discoverable, not displayed — players learn personality through behaviour
 *  - Variation per playthrough — species have a spectrum, each game rolls within it
 *  - Maslow overrides everything — survival cuts through personality
 *  - Context-driven mood shifts — events trigger changes at attachment-style rates
 */

// ---------------------------------------------------------------------------
// Core trait dimensions (Big Five + Honesty-Humility from HEXACO)
// ---------------------------------------------------------------------------

/**
 * The six core personality dimensions. Each is scored 0-100.
 * Species data stores { median, stddev } for per-game rolling.
 */
export interface CoreTraits {
  /** Emotional reactivity, anxiety, mood swings, anger-in. */
  neuroticism: number;
  /** Social initiative, alliance breadth, attention-seeking. */
  extraversion: number;
  /** Curiosity, tolerance, unconventionality, moral universalism. */
  openness: number;
  /** Cooperation, trust, forgiveness, conflict avoidance. */
  agreeableness: number;
  /** Reliability, planning, follow-through, loyalty. */
  conscientiousness: number;
  /** Fairness, sincerity, exploitation resistance. */
  honestyHumility: number;
}

/** Keys of the six core trait dimensions. */
export type CoreTraitKey = keyof CoreTraits;

/** All six core trait keys, useful for iteration. */
export const CORE_TRAIT_KEYS: readonly CoreTraitKey[] = [
  'neuroticism',
  'extraversion',
  'openness',
  'agreeableness',
  'conscientiousness',
  'honestyHumility',
] as const;

// ---------------------------------------------------------------------------
// Trait distribution (for species data — median + stddev for rolling)
// ---------------------------------------------------------------------------

/** A trait's statistical distribution for per-game rolling. */
export interface TraitDistribution {
  /** Central tendency for this species (0-100). */
  median: number;
  /** Standard deviation — wider = more variation between games. */
  stddev: number;
}

/** Core traits as distributions rather than fixed values. */
export type CoreTraitDistributions = Record<CoreTraitKey, TraitDistribution>;

// ---------------------------------------------------------------------------
// Subfacets
// ---------------------------------------------------------------------------

/**
 * Subfacets add granularity to core dimensions. Each species has 2-5 key
 * subfacets that define their distinctive personality. Complex species
 * (Teranos, Vethara) get more; simpler ones (Zorvathi) get fewer.
 *
 * Common subfacets by parent dimension:
 *  N: anxiety, angerHostility, depression, selfConsciousness, vulnerability
 *  E: warmth, assertiveness, excitement, positiveEmotions, gregariousness
 *  O: fantasy, aesthetics, feelings, actions, ideas, values
 *  A: trust, compliance, altruism, straightforwardness, tenderness, modesty
 *  C: competence, order, dutifulness, achievementStriving, deliberation, selfDiscipline
 *  H: sincerity, fairness, greedAvoidance, modesty
 */
export type SubfacetDistributions = Record<string, TraitDistribution>;

// ---------------------------------------------------------------------------
// Attachment styles
// ---------------------------------------------------------------------------

/** Attachment style governs relationship dynamics and mood volatility. */
export type AttachmentStyle =
  | 'secure'
  | 'anxious'
  | 'avoidant'
  | 'fearful_avoidant';

// ---------------------------------------------------------------------------
// Enneagram
// ---------------------------------------------------------------------------

/** Enneagram type (1-9) provides core fear/desire and stress/growth directions. */
export interface EnneagramProfile {
  /** Primary type (1-9). */
  type: number;
  /** Wing — adjacent type that flavours the primary. */
  wing: number;
  /** Type shifted toward under stress (disintegration). */
  stressDirection: number;
  /** Type shifted toward when thriving (integration). */
  growthDirection: number;
}

// ---------------------------------------------------------------------------
// Dark Triad / Tetrad
// ---------------------------------------------------------------------------

/** Dark personality traits. Most species score low; a few are elevated. */
export interface DarkTriadScores {
  /** Grandiose self-regard, entitlement, admiration-seeking. 0-100. */
  narcissism: number;
  /** Strategic manipulation, cynicism, long-game exploitation. 0-100. */
  machiavellianism: number;
  /** Callous-unemotional, fearless, instrumental aggression. 0-100. */
  psychopathy: number;
  /** Deriving pleasure from others' suffering. 0-100. */
  sadism: number;
}

// ---------------------------------------------------------------------------
// Moral Foundations
// ---------------------------------------------------------------------------

/** Haidt's moral foundations — drive faction-level values and incomprehension. */
export interface MoralFoundations {
  /** Compassion, protection from harm. 0-100. */
  careHarm: number;
  /** Justice, proportionality, reciprocity. 0-100. */
  fairnessCheating: number;
  /** In-group solidarity, self-sacrifice, tribal bonds. 0-100. */
  loyaltyBetrayal: number;
  /** Hierarchy, respect, tradition, obedience. 0-100. */
  authoritySubversion: number;
  /** Purity, sacredness, disgust sensitivity. 0-100. */
  sanctityDegradation: number;
  /** Freedom from domination, resistance to control. 0-100. */
  libertyOppression: number;
}

// ---------------------------------------------------------------------------
// First-contact attitude
// ---------------------------------------------------------------------------

/** Range for rolling first-contact attitude per game. */
export interface FirstContactRange {
  /** Minimum first-contact attitude. */
  min: number;
  /** Maximum first-contact attitude. */
  max: number;
}

// ---------------------------------------------------------------------------
// Species Personality (data layer — what goes in JSON files)
// ---------------------------------------------------------------------------

/**
 * Complete personality definition for a species. Stored as JSON data files
 * in data/species/personality/. This is the TEMPLATE — actual per-game
 * personalities are rolled from these distributions.
 */
export interface SpeciesPersonalityData {
  /** Species ID — must match the species data file. */
  speciesId: string;

  /** Core Big Five + H dimensions as distributions for per-game rolling. */
  traits: CoreTraitDistributions;

  /** Selected subfacets that define this species' distinctive personality. */
  subfacets: SubfacetDistributions;

  /** Attachment style governing relationship dynamics. */
  attachmentStyle: AttachmentStyle;

  /** Enneagram profile for stress/growth state machine. */
  enneagram: EnneagramProfile;

  /** Dark Triad/Tetrad scores (most species low). */
  darkTriad: DarkTriadScores;

  /** Moral foundations weights driving faction-level values. */
  moralFoundations: MoralFoundations;

  /** First-contact attitude range (rolled per game). */
  firstContactAttitude: FirstContactRange;

  /**
   * Brief thematic description of this species' psychological character.
   * Not used mechanically — helps modders understand the design intent.
   */
  psychologicalTheme: string;
}

// ---------------------------------------------------------------------------
// Rolled Personality (per-game instance)
// ---------------------------------------------------------------------------

/**
 * A concrete personality rolled for a specific game instance from a species'
 * distribution data. Fixed values, not distributions.
 */
export interface RolledPersonality {
  /** The species this was rolled from. */
  speciesId: string;

  /** Concrete core trait values (0-100), rolled from species distributions. */
  traits: CoreTraits;

  /** Concrete subfacet values (0-100), rolled from species distributions. */
  subfacets: Record<string, number>;

  /** Attachment style (inherited from species data). */
  attachmentStyle: AttachmentStyle;

  /** Enneagram profile (inherited from species data). */
  enneagram: EnneagramProfile;

  /** Concrete Dark Triad scores for this game instance. */
  darkTriad: DarkTriadScores;

  /** Concrete moral foundations for this game instance. */
  moralFoundations: MoralFoundations;

  /** Concrete first-contact attitude rolled for this game. */
  firstContactAttitude: number;

  /** Difficulty level used when rolling (for reference). */
  difficulty: DifficultyLevel;
}

// ---------------------------------------------------------------------------
// Difficulty
// ---------------------------------------------------------------------------

/** Game difficulty levels that shift personality distributions. */
export type DifficultyLevel = 'easy' | 'normal' | 'hard' | 'brutal';

/**
 * Difficulty modifiers applied to personality rolling.
 * Positive values increase the trait; negative values decrease it.
 */
export interface DifficultyModifiers {
  agreeableness: number;
  honestyHumility: number;
  neuroticism: number;
  darkTriadMultiplier: number;
}

/** Difficulty modifier presets. */
export const DIFFICULTY_MODIFIERS: Record<DifficultyLevel, DifficultyModifiers> = {
  easy:   { agreeableness: 10, honestyHumility: 10, neuroticism: -10, darkTriadMultiplier: 0.5 },
  normal: { agreeableness: 0,  honestyHumility: 0,  neuroticism: 0,   darkTriadMultiplier: 1.0 },
  hard:   { agreeableness: -10, honestyHumility: -10, neuroticism: 10, darkTriadMultiplier: 1.5 },
  brutal: { agreeableness: -20, honestyHumility: -10, neuroticism: 20, darkTriadMultiplier: 2.0 },
};

// ---------------------------------------------------------------------------
// Species-pair affinity matrix
// ---------------------------------------------------------------------------

/**
 * Base affinity between two species (-50 to +50). Represents inherent
 * chemistry before any game events. Modified at runtime by behaviour,
 * cultural learning, and shared threats.
 */
export interface SpeciesPairAffinity {
  /** Species A ID. */
  speciesA: string;
  /** Species B ID. */
  speciesB: string;
  /** Base affinity modifier (-50 to +50). */
  baseAffinity: number;
  /** Brief reason for this affinity (for modders / debugging). */
  reason: string;
}

/**
 * The complete affinity matrix, stored as a flat array of pair entries.
 * Only one entry per pair (A-B, not A-B and B-A). Lookup function
 * handles symmetry.
 */
export interface AffinityMatrix {
  /** All species-pair affinity entries. */
  pairs: SpeciesPairAffinity[];
  /** Default affinity for species pairs not in the matrix. */
  defaultAffinity: number;
}

// ---------------------------------------------------------------------------
// Mood state (used by Phase 2, defined here for type completeness)
// ---------------------------------------------------------------------------

/** Multi-dimensional mood state. Not a single happy/angry axis. */
export interface MoodState {
  /** Negative to positive overall feeling. -100 to +100. */
  valence: number;
  /** Calm to agitated. 0-100. High arousal = more extreme actions. */
  arousal: number;
  /** Submissive to dominant. 0-100. Affects negotiation stance. */
  dominance: number;
  /** Relaxed to panicked. 0-100. Attachment anxiety amplifier. */
  anxiety: number;
  /** Calm to furious. 0-100. Separate from valence for grudges. */
  anger: number;
}

// ---------------------------------------------------------------------------
// Maslow needs (used by Phase 2, defined here for type completeness)
// ---------------------------------------------------------------------------

/** Maslow's hierarchy of needs tracking. Lowest unmet need drives behaviour. */
export interface MaslowNeeds {
  /** Food, energy, basic resources. 0-100. */
  physiological: number;
  /** Military security, territorial integrity. 0-100. */
  safety: number;
  /** Alliances, trade partners, cultural exchange. 0-100. */
  belonging: number;
  /** Galactic recognition, technological prestige. 0-100. */
  esteem: number;
  /** Victory progress, expansion, research breakthroughs. 0-100. */
  selfActualisation: number;
}

// ---------------------------------------------------------------------------
// Stress levels (used by Phase 2, defined here for type completeness)
// ---------------------------------------------------------------------------

/** Five-level stress escalation model. */
export type StressLevel =
  | 'baseline'
  | 'moderate'
  | 'high'
  | 'extreme'
  | 'recovery';

// ---------------------------------------------------------------------------
// Empire psychological state (runtime, per-game)
// ---------------------------------------------------------------------------

/**
 * Complete psychological state for an empire at a point in time.
 * Updated every tick by the psychology engine. Stored on GameTickState.
 */
export interface EmpirePsychologicalState {
  /** The empire's rolled personality (from game start). */
  personality: RolledPersonality;
  /** Current effective traits (may differ from rolled due to stress/growth). */
  effectiveTraits: CoreTraits;
  /** Current mood (multi-dimensional). */
  mood: MoodState;
  /** Current Maslow need levels. */
  needs: MaslowNeeds;
  /** Current stress level. */
  stressLevel: StressLevel;
  /** Ticks since the last crisis ended (for recovery tracking). */
  ticksSinceCrisis: number;
  /**
   * Psychology-driven relationships with other empires, keyed by target empire ID.
   * Created at first contact, updated per tick.
   */
  relationships: Record<string, import('./diplomacy-v2.js').PsychRelationship>;
}
