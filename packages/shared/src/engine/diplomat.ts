/**
 * Diplomat character engine — pure functions for generating, assigning,
 * and simulating diplomat characters in diplomatic encounters.
 *
 * All functions are side-effect free. Callers must persist the returned state.
 *
 * Design goals:
 *  - Diplomat skills (negotiation, perception, charisma) affect all outcomes
 *  - Species aptitude and training level seed initial skill values
 *  - Perception skill determines accuracy when reading private stances
 *  - Meeting summaries are flavourful, species-aware, and skill-dependent
 *  - Diplomats gain experience over time and may be turned by enemy spies
 *  - Personal agendas create emergent narrative through loyalty drift
 */

import type {
  Diplomat,
  DiplomatTrait,
  DiplomaticStance,
  ConfidenceLevel,
} from '../types/diplomacy.js';
import { generateId } from '../utils/id.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Experience points gained per tick while assigned to a relationship. */
export const XP_PER_TICK = 1;

/** Experience points required per skill level (cumulative). */
export const XP_PER_LEVEL = 100;

/** Maximum skill level for any diplomat skill. */
export const MAX_SKILL = 10;

/** Minimum skill level for any diplomat skill. */
export const MIN_SKILL = 1;

/** Loyalty drift per tick when diplomat has a conflicting personal agenda. */
export const AGENDA_LOYALTY_DRIFT = -0.3;

/** Loyalty drift per tick when diplomat is well-treated (no agenda conflict). */
export const POSITIVE_LOYALTY_DRIFT = 0.1;

/** Loyalty threshold below which a diplomat becomes susceptible to turning. */
export const VULNERABLE_LOYALTY_THRESHOLD = 30;

// ---------------------------------------------------------------------------
// Name generation word lists — species-themed
// ---------------------------------------------------------------------------

/**
 * Diplomat name prefixes grouped by species.
 * Unknown species fall back to a generic set.
 */
const SPECIES_NAME_PREFIXES: Record<string, string[]> = {
  khazari: [
    'Gromak', 'Thurgon', 'Beldak', 'Kazrim', 'Vorthak', 'Dralgor', 'Ironfel',
    'Stonemar', 'Ashgrim', 'Brakkel',
  ],
  vaelori: [
    'Aethrin', 'Lysara', 'Velindra', 'Sorenith', 'Caelum', 'Elowen', 'Thalmir',
    'Aurelian', 'Silvane', 'Iridael',
  ],
  teranos: [
    'Marcus', 'Helena', 'Victor', 'Octavia', 'Cassius', 'Praetor', 'Dominus',
    'Valeria', 'Severan', 'Tiberian',
  ],
  sylvani: [
    'Verdael', 'Thornwyn', 'Rootsong', 'Blossara', 'Fernwick', 'Mosswind',
    'Leafshadow', 'Willowmere', 'Briarveil', 'Oakheart',
  ],
  nexari: [
    'Axiom', 'Nexion', 'Vertex', 'Cipher', 'Synapse', 'Quorum', 'Vector',
    'Lattice', 'Prion', 'Cortex',
  ],
  drakmari: [
    'Skareth', 'Vyraxis', 'Drakenfel', 'Scorian', 'Pyraxis', 'Embrath',
    'Cindrak', 'Ashtalon', 'Flamegar', 'Obsidrak',
  ],
  zorvathi: [
    'Zul\'keth', 'Vorathis', 'Xenndar', 'Skrythos', 'Morphael', 'Zethryn',
    'Kryptael', 'Voidmar', 'Shadowfen', 'Nullaxis',
  ],
  ashkari: [
    'Ashwind', 'Dunelar', 'Sandral', 'Miragael', 'Solarin', 'Dustmere',
    'Oasisfel', 'Hazewyn', 'Driftael', 'Scorchel',
  ],
  luminari: [
    'Radiance', 'Lumiel', 'Photaris', 'Gloweth', 'Brillar', 'Aurorin',
    'Beacon', 'Prismael', 'Shimmerel', 'Starlight',
  ],
};

const GENERIC_NAME_PREFIXES = [
  'Alderon', 'Belthar', 'Corvain', 'Delphis', 'Erathon', 'Faelon',
  'Gavriel', 'Halcyon', 'Iskander', 'Jovaris',
];

const NAME_SUFFIXES = [
  ' the Eloquent', ' the Shrewd', ' the Silver-tongued', ' the Perceptive',
  ' the Steadfast', ' the Subtle', ' the Bold', ' the Cautious',
  ' the Keen-eyed', ' the Gracious',
];

// ---------------------------------------------------------------------------
// Trait pool
// ---------------------------------------------------------------------------

const POSITIVE_TRAITS: DiplomatTrait[] = [
  'honest', 'conciliatory', 'xenophile', 'incorruptible',
];

const NEGATIVE_TRAITS: DiplomatTrait[] = [
  'deceptive', 'aggressive', 'xenophobe', 'corrupt',
];

// ---------------------------------------------------------------------------
// Personal agendas
// ---------------------------------------------------------------------------

const PERSONAL_AGENDAS = [
  'Seeks personal wealth through diplomatic back-channels',
  'Secretly sympathises with the assigned target empire',
  'Desires promotion to head of the diplomatic corps',
  'Harbours a grudge against their own government',
  'Pursuing a clandestine romantic entanglement abroad',
  'Working to establish a personal trade network',
  'Ideologically committed to galactic peace at any cost',
  'Believes their species is destined to rule',
  'Collecting intelligence for a rival faction at home',
  'Motivated by academic curiosity about alien cultures',
  'Loyal only to their species, not their government',
  'Seeking asylum abroad if political winds shift',
];

// ---------------------------------------------------------------------------
// Meeting summary templates
// ---------------------------------------------------------------------------

/**
 * High-perception templates: the diplomat detects nuance and subtext.
 * Placeholders: {species} = target species, {diplomat} = target diplomat name,
 * {stance} = assessed stance description.
 */
const HIGH_PERCEPTION_TEMPLATES = [
  'The {species} ambassador, {diplomat}, maintained a facade of cordiality, but their body language betrayed deep unease when fleet deployments were raised. Assessment: {stance}.',
  '{diplomat} of the {species} delegation was evasive about their empire\'s fleet movements near our border systems. Their reluctance speaks volumes. Assessment: {stance}.',
  'During the formal reception, {diplomat} made three separate attempts to steer conversation away from trade imbalances. The {species} are clearly hiding something. Assessment: {stance}.',
  'Our diplomat detected micro-expressions of hostility from {diplomat} whenever military cooperation was mentioned. The {species} public overtures of friendship ring hollow. Assessment: {stance}.',
  '{diplomat} let slip a reference to "contingency planning" before quickly correcting to "cooperative planning". The {species} are preparing for a less friendly future. Assessment: {stance}.',
  'The {species} envoy {diplomat} was notably warmer when discussing cultural exchange but turned cold and formal on security matters. Their private position is clearly more nuanced than their public stance. Assessment: {stance}.',
  'Analysis of {diplomat}\'s speech patterns reveals careful word selection designed to avoid commitment. The {species} are keeping their options open. Assessment: {stance}.',
  'Our representative noticed that {diplomat} consulted encrypted communications three times during the informal dinner — unusual for the {species}, who typically value directness. Assessment: {stance}.',
  '{diplomat} appeared genuinely surprised by our economic data, suggesting the {species} intelligence apparatus has gaps we can exploit. Assessment: {stance}.',
  'The {species} delegation led by {diplomat} arrived with twice the usual security detail. Combined with their carefully neutral language, this suggests heightened internal anxiety. Assessment: {stance}.',
  'Our diplomat observed that {diplomat} avoided eye contact when discussing the non-aggression pact, a known {species} tell for deception. Assessment: {stance}.',
  'During the state banquet, {diplomat} spoke at length about "historical friendship" — a phrase the {species} traditionally use when they are about to break one. Assessment: {stance}.',
];

/**
 * Medium-perception templates: the diplomat picks up some signals but misses others.
 */
const MEDIUM_PERCEPTION_TEMPLATES = [
  'The meeting with {diplomat} of the {species} appeared to go well, though some of their responses felt rehearsed. Assessment: {stance}.',
  '{diplomat} was polite but non-committal on most substantive issues. Difficult to gauge the {species} true intentions from this session alone. Assessment: {stance}.',
  'The {species} representative {diplomat} seemed genuinely interested in trade discussions but deflected questions about military matters. Assessment: {stance}.',
  'Our diplomat reports that {diplomat} was friendly but guarded. The {species} delegation shared little of strategic value. Assessment: {stance}.',
  'The tone of the meeting with the {species} was professional. {diplomat} made several proposals worth considering, though their motives remain unclear. Assessment: {stance}.',
  '{diplomat} of the {species} seemed to be probing our defensive capabilities under the guise of "security cooperation" discussions. Assessment: {stance}.',
  'The {species} envoy {diplomat} was warmer than expected. Whether this reflects genuine goodwill or diplomatic theatre remains to be seen. Assessment: {stance}.',
  'Our representative found {diplomat} to be measured and cautious — typical of {species} diplomats. No major revelations, but no red flags either. Assessment: {stance}.',
];

/**
 * Low-perception templates: the diplomat misses important signals and provides
 * bland or misleading assessments.
 */
const LOW_PERCEPTION_TEMPLATES = [
  'The meeting with the {species} delegation was cordial. {diplomat} expressed interest in continued dialogue.',
  'Our diplomat reports a pleasant exchange with {diplomat}. The {species} seem amenable to cooperation.',
  '{diplomat} of the {species} was very friendly. Our representative believes relations are in good shape.',
  'The {species} ambassador {diplomat} hosted a splendid reception. Everything appears to be going well.',
  'Our diplomat enjoyed productive discussions with {diplomat}. The {species} leadership seems reasonable.',
  '{diplomat} was most gracious. The {species} clearly value our relationship.',
  'A routine meeting with the {species} envoy {diplomat}. Nothing of particular note to report.',
  'The session with {diplomat} was unremarkable. The {species} seem content with the status quo.',
  'Our representative found {diplomat} to be charming and forthcoming. A most satisfactory meeting.',
  '{diplomat} extended an invitation to visit {species} space. Our diplomat recommends accepting.',
];

// ---------------------------------------------------------------------------
// Stance description helpers
// ---------------------------------------------------------------------------

/**
 * Convert a numeric position to a human-readable stance description.
 */
function describeStance(position: number): string {
  if (position >= 75) return 'strongly friendly — likely a genuine ally';
  if (position >= 40) return 'positively inclined — open to cooperation';
  if (position >= 10) return 'cautiously warm — willing to engage but wary';
  if (position >= -10) return 'neutral — no strong feelings either way';
  if (position >= -40) return 'cool and distant — harbouring reservations';
  if (position >= -75) return 'hostile — actively working against our interests';
  return 'deeply hostile — consider them an active threat';
}

/**
 * Convert a confidence level to a numeric accuracy factor (0-1).
 */
function confidenceToAccuracy(confidence: ConfidenceLevel): number {
  switch (confidence) {
    case 'very_high': return 0.95;
    case 'high': return 0.80;
    case 'medium': return 0.60;
    case 'low': return 0.35;
    case 'very_low': return 0.15;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Pick a random element from an array using the provided rng. */
function randPick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

/** Random integer in [lo, hi] inclusive. */
function randInt(rng: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/**
 * Map a perception skill (1-10) to a ConfidenceLevel.
 */
function skillToConfidence(perceptionSkill: number): ConfidenceLevel {
  if (perceptionSkill >= 9) return 'very_high';
  if (perceptionSkill >= 7) return 'high';
  if (perceptionSkill >= 5) return 'medium';
  if (perceptionSkill >= 3) return 'low';
  return 'very_low';
}

// ---------------------------------------------------------------------------
// Public API — diplomat generation
// ---------------------------------------------------------------------------

/**
 * Generate a new diplomat character.
 *
 * Skills are derived from:
 *  1. Species diplomacy trait (1-10) — provides a baseline
 *  2. Training level (0-3) — adds bonus skill points
 *  3. Random variance from the rng
 *
 * Training levels:
 *  - 0: untrained (embassy recruit)
 *  - 1: basic training (diplomatic academy)
 *  - 2: advanced training (embassy complex)
 *  - 3: elite training (diplomatic corps headquarters)
 *
 * @param speciesId      - Species of the diplomat.
 * @param empireId       - Empire the diplomat serves.
 * @param speciesDiplomacyTrait - Species diplomacy trait value (1-10).
 * @param trainingLevel  - Training level from buildings (0-3).
 * @param rng            - Random number generator returning values in [0, 1).
 * @returns A new Diplomat character.
 */
export function generateDiplomat(
  speciesId: string,
  empireId: string,
  speciesDiplomacyTrait: number,
  trainingLevel: number,
  rng: () => number,
): Diplomat {
  const baseSkill = clamp(speciesDiplomacyTrait, 1, 10);
  const training = clamp(trainingLevel, 0, 3);

  // Each skill gets: base from species trait, training bonus, random variance
  const calcSkill = (): number => {
    const base = Math.round(baseSkill * 0.6);           // 60% from species
    const trainingBonus = training;                       // +0 to +3 from training
    const variance = randInt(rng, -1, 2);                // Random variance
    return clamp(base + trainingBonus + variance, MIN_SKILL, MAX_SKILL);
  };

  const negotiation = calcSkill();
  const perception = calcSkill();
  const charisma = calcSkill();

  // Generate name
  const prefixes = SPECIES_NAME_PREFIXES[speciesId] ?? GENERIC_NAME_PREFIXES;
  const firstName = randPick(rng, prefixes);
  // 30% chance of an epithet
  const hasEpithet = rng() < 0.3;
  const name = hasEpithet
    ? firstName + randPick(rng, NAME_SUFFIXES)
    : firstName;

  // Assign 1-2 traits based on skill distribution
  const traits: DiplomatTrait[] = [];
  if (charisma >= 7 && rng() > 0.4) traits.push(randPick(rng, ['honest', 'conciliatory']));
  if (charisma <= 3 && rng() > 0.4) traits.push(randPick(rng, ['aggressive', 'xenophobe']));
  if (perception >= 7 && rng() > 0.5) traits.push('honest');
  if (perception <= 3 && rng() > 0.5) traits.push('deceptive');
  if (negotiation >= 8 && rng() > 0.5) traits.push('incorruptible');
  if (negotiation <= 2 && rng() > 0.5) traits.push('corrupt');

  // Ensure at least one trait
  if (traits.length === 0) {
    traits.push(rng() > 0.5 ? randPick(rng, POSITIVE_TRAITS) : randPick(rng, NEGATIVE_TRAITS));
  }

  // Deduplicate traits
  const uniqueTraits = [...new Set(traits)];

  // Starting loyalty: 60-90 for trained diplomats, 40-70 for untrained
  const baseLoyalty = training >= 1 ? 60 : 40;
  const loyalty = clamp(baseLoyalty + randInt(rng, 0, 30), 0, 100);

  // Personal agenda: 40% chance
  const hasAgenda = rng() < 0.4;
  const personalAgenda = hasAgenda ? randPick(rng, PERSONAL_AGENDAS) : undefined;

  return {
    id: generateId(),
    name,
    speciesId,
    empireId,
    negotiationSkill: negotiation,
    perceptionSkill: perception,
    charisma,
    loyalty,
    experience: 0,
    traits: uniqueTraits,
    assignedRelationship: undefined,
    personalAgenda,
    isCompromised: false,
    compromisedBy: undefined,
  };
}

// ---------------------------------------------------------------------------
// Public API — assignment
// ---------------------------------------------------------------------------

/**
 * Assign a diplomat to manage a relationship with a target empire.
 *
 * Returns a new Diplomat object with the assignedRelationship updated.
 * Does not mutate the input diplomat.
 *
 * @param diplomat       - The diplomat to assign.
 * @param targetEmpireId - The empire this diplomat will manage relations with.
 * @returns Updated diplomat with the new assignment.
 */
export function assignDiplomat(
  diplomat: Diplomat,
  targetEmpireId: string,
): Diplomat {
  return {
    ...diplomat,
    traits: [...diplomat.traits],
    assignedRelationship: targetEmpireId,
  };
}

// ---------------------------------------------------------------------------
// Public API — stance assessment
// ---------------------------------------------------------------------------

/**
 * Have a diplomat assess the true diplomatic stance of a target empire.
 *
 * The diplomat's perception skill determines the accuracy of the assessment:
 *  - High skill (8-10): very small error margin, high/very_high confidence
 *  - Medium skill (5-7): moderate error, medium confidence
 *  - Low skill (1-4): large error, low/very_low confidence — may be wildly wrong
 *
 * The assessed position is derived from the true private stance plus random
 * noise scaled inversely to skill.
 *
 * @param diplomat            - The diplomat making the assessment.
 * @param targetPublicStance  - The target empire's public position (-100 to +100).
 * @param targetPrivateStance - The target empire's true private position (-100 to +100).
 * @param rng                 - Random number generator returning values in [0, 1).
 * @returns A DiplomaticStance representing the diplomat's assessment.
 */
export function assessDiplomaticStance(
  diplomat: Diplomat,
  targetPublicStance: number,
  targetPrivateStance: number,
  rng: () => number,
): DiplomaticStance {
  const skill = clamp(diplomat.perceptionSkill, MIN_SKILL, MAX_SKILL);
  const confidence = skillToConfidence(skill);

  // Error margin scales inversely with skill
  // Skill 1: ±80 error, Skill 5: ±30 error, Skill 10: ±5 error
  const maxError = Math.round(85 - skill * 8);
  const error = randInt(rng, -maxError, maxError);

  // Compromised diplomats may report misleading assessments
  const assessmentBias = diplomat.isCompromised ? randInt(rng, -30, 30) : 0;

  const assessedPosition = clamp(
    targetPrivateStance + error + assessmentBias,
    -100,
    100,
  );

  return {
    publicPosition: targetPublicStance,
    privatePosition: targetPrivateStance,
    confidenceInReading: confidence,
    assessedPrivatePosition: assessedPosition,
  };
}

// ---------------------------------------------------------------------------
// Public API — meeting summary generation
// ---------------------------------------------------------------------------

/**
 * Generate a narrative summary of a diplomatic meeting between two diplomats.
 *
 * The quality and accuracy of the summary depends on the reporting diplomat's
 * perception skill:
 *  - High skill (7+): detailed, insightful observations that reveal subtext
 *  - Medium skill (4-6): some useful observations mixed with surface-level notes
 *  - Low skill (1-3): bland summaries that miss important signals, potentially misleading
 *
 * Summaries are species-aware, referencing the target diplomat's species by name.
 * At least 20 distinct templates ensure variety across multiple meetings.
 *
 * @param diplomat       - The diplomat writing the report (perception skill matters).
 * @param targetDiplomat - The foreign diplomat they met with.
 * @param trueStance     - The true private stance of the target empire (-100 to +100).
 * @param rng            - Random number generator returning values in [0, 1).
 * @returns A narrative summary string suitable for display in the diplomacy panel.
 */
export function generateMeetingSummary(
  diplomat: Diplomat,
  targetDiplomat: Diplomat,
  trueStance: number,
  rng: () => number,
): string {
  const skill = clamp(diplomat.perceptionSkill, MIN_SKILL, MAX_SKILL);
  const species = targetDiplomat.speciesId;
  const diplomatName = targetDiplomat.name;

  // Determine which template pool to draw from
  let template: string;
  if (skill >= 7) {
    template = randPick(rng, HIGH_PERCEPTION_TEMPLATES);
  } else if (skill >= 4) {
    template = randPick(rng, MEDIUM_PERCEPTION_TEMPLATES);
  } else {
    template = randPick(rng, LOW_PERCEPTION_TEMPLATES);
  }

  // Generate the assessed stance description for high/medium perception
  const stanceDesc = describeStance(trueStance + randInt(rng, -10 * (10 - skill), 10 * (10 - skill)));

  // Replace placeholders
  const summary = template
    .replace(/\{species\}/g, species)
    .replace(/\{diplomat\}/g, diplomatName)
    .replace(/\{stance\}/g, stanceDesc);

  return summary;
}

// ---------------------------------------------------------------------------
// Public API — per-tick processing
// ---------------------------------------------------------------------------

/** Events that can occur during diplomat tick processing. */
export interface DiplomatTickEvent {
  type: 'skill_up' | 'loyalty_drop' | 'loyalty_rise' | 'agenda_conflict' | 'defection_risk';
  diplomatId: string;
  description: string;
}

/**
 * Process one game tick for a diplomat character.
 *
 * Per tick:
 *  1. Gain experience if assigned to a relationship
 *  2. Check for skill level-ups from accumulated experience
 *  3. Apply loyalty drift based on personal agenda and treatment
 *  4. Generate events for notable changes
 *
 * @param diplomat - The diplomat to process.
 * @param tick     - Current game tick.
 * @param rng      - Random number generator returning values in [0, 1).
 * @returns Updated diplomat and any events generated this tick.
 */
export function processDiplomatTick(
  diplomat: Diplomat,
  tick: number,
  rng: () => number,
): { diplomat: Diplomat; events: DiplomatTickEvent[] } {
  const next: Diplomat = {
    ...diplomat,
    traits: [...diplomat.traits],
  };
  const events: DiplomatTickEvent[] = [];

  // ── Experience gain ──────────────────────────────────────────────────────
  if (next.assignedRelationship) {
    next.experience += XP_PER_TICK;

    // Check for skill level-ups: every XP_PER_LEVEL points, one random skill gains +1
    const totalLevels = Math.floor(next.experience / XP_PER_LEVEL);
    const prevLevels = Math.floor((next.experience - XP_PER_TICK) / XP_PER_LEVEL);

    if (totalLevels > prevLevels) {
      // Pick a random skill to improve
      const roll = rng();
      if (roll < 0.33 && next.negotiationSkill < MAX_SKILL) {
        next.negotiationSkill += 1;
        events.push({
          type: 'skill_up',
          diplomatId: next.id,
          description: `${next.name}'s negotiation skill improved to ${next.negotiationSkill}.`,
        });
      } else if (roll < 0.66 && next.perceptionSkill < MAX_SKILL) {
        next.perceptionSkill += 1;
        events.push({
          type: 'skill_up',
          diplomatId: next.id,
          description: `${next.name}'s perception skill improved to ${next.perceptionSkill}.`,
        });
      } else if (next.charisma < MAX_SKILL) {
        next.charisma += 1;
        events.push({
          type: 'skill_up',
          diplomatId: next.id,
          description: `${next.name}'s charisma improved to ${next.charisma}.`,
        });
      }
    }
  }

  // ── Loyalty drift ────────────────────────────────────────────────────────
  if (next.personalAgenda && next.assignedRelationship) {
    // Agenda conflicts slowly erode loyalty
    next.loyalty = clamp(next.loyalty + AGENDA_LOYALTY_DRIFT, 0, 100);

    // Occasional agenda conflict events (roughly every 50 ticks)
    if (rng() < 0.02) {
      events.push({
        type: 'agenda_conflict',
        diplomatId: next.id,
        description: `${next.name} is distracted by personal interests: ${next.personalAgenda}`,
      });
    }
  } else if (next.assignedRelationship) {
    // Loyal diplomats with no conflicting agenda slowly gain loyalty
    next.loyalty = clamp(next.loyalty + POSITIVE_LOYALTY_DRIFT, 0, 100);

    if (next.loyalty >= 95 && rng() < 0.01) {
      events.push({
        type: 'loyalty_rise',
        diplomatId: next.id,
        description: `${next.name} has become deeply devoted to the empire's cause.`,
      });
    }
  }

  // ── Defection risk warning ───────────────────────────────────────────────
  if (next.loyalty < VULNERABLE_LOYALTY_THRESHOLD && !next.isCompromised) {
    if (rng() < 0.05) {
      events.push({
        type: 'defection_risk',
        diplomatId: next.id,
        description: `${next.name}'s loyalty is dangerously low (${Math.round(next.loyalty)}%). They may be vulnerable to enemy recruitment.`,
      });
    }
  }

  // ── Loyalty drop event ───────────────────────────────────────────────────
  if (next.loyalty < diplomat.loyalty && next.loyalty < 50 && rng() < 0.03) {
    events.push({
      type: 'loyalty_drop',
      diplomatId: next.id,
      description: `${next.name}'s loyalty to the empire has weakened to ${Math.round(next.loyalty)}%.`,
    });
  }

  return { diplomat: next, events };
}

// ---------------------------------------------------------------------------
// Public API — counter-espionage: diplomat compromise check
// ---------------------------------------------------------------------------

/**
 * Determine whether an enemy spy can turn (compromise) a diplomat.
 *
 * The check considers:
 *  - Enemy spy skill: higher skill → more persuasive
 *  - Diplomat loyalty: lower loyalty → more vulnerable
 *  - Diplomat traits: 'incorruptible' provides strong resistance;
 *    'corrupt' makes turning much easier
 *
 * Formula:
 *   baseChance = (enemySpySkill / 20) × (1 - loyalty / 100)
 *   Modified by traits: corrupt → ×2.0, incorruptible → ×0.1
 *
 * @param diplomat      - The diplomat being targeted for recruitment.
 * @param enemySpySkill - Skill level of the enemy spy attempting the turn (1-10).
 * @param rng           - Random number generator returning values in [0, 1).
 * @returns True if the diplomat is successfully turned.
 */
export function checkCompromised(
  diplomat: Diplomat,
  enemySpySkill: number,
  rng: () => number,
): boolean {
  // Already compromised diplomats can't be turned again
  if (diplomat.isCompromised) return false;

  const skill = clamp(enemySpySkill, 1, 10);
  const loyalty = clamp(diplomat.loyalty, 0, 100);

  // Base turning chance
  let chance = (skill / 20) * (1 - loyalty / 100);

  // Trait modifiers
  if (diplomat.traits.includes('incorruptible')) {
    chance *= 0.1; // Almost impossible to turn
  }
  if (diplomat.traits.includes('corrupt')) {
    chance *= 2.0; // Very easy to turn
  }

  // Low loyalty makes diplomats much more susceptible
  if (loyalty < VULNERABLE_LOYALTY_THRESHOLD) {
    chance *= 1.5;
  }

  return rng() < clamp(chance, 0, 0.95);
}

/**
 * Mark a diplomat as compromised by an enemy empire.
 *
 * Returns a new diplomat object; does not mutate the input.
 *
 * @param diplomat       - The diplomat being turned.
 * @param compromisedBy  - Empire ID that turned this diplomat.
 * @returns Updated diplomat with isCompromised = true.
 */
export function compromiseDiplomat(
  diplomat: Diplomat,
  compromisedBy: string,
): Diplomat {
  return {
    ...diplomat,
    traits: [...diplomat.traits],
    isCompromised: true,
    compromisedBy,
  };
}

/**
 * Uncover and rehabilitate a compromised diplomat.
 *
 * Resets the compromised state but imposes a loyalty penalty.
 *
 * @param diplomat     - The compromised diplomat.
 * @param loyaltyPenalty - How much loyalty to deduct (default 20).
 * @returns Updated diplomat, no longer compromised but with reduced loyalty.
 */
export function rehabilitateDiplomat(
  diplomat: Diplomat,
  loyaltyPenalty: number = 20,
): Diplomat {
  return {
    ...diplomat,
    traits: [...diplomat.traits],
    isCompromised: false,
    compromisedBy: undefined,
    loyalty: clamp(diplomat.loyalty - loyaltyPenalty, 0, 100),
  };
}
