/**
 * Relationship Engine
 *
 * Multi-dimensional relationship state that evolves through events,
 * contact patterns, and personality-driven modifiers.
 *
 * Replaces the flat attitude/trust model with:
 *  - warmth, respect, trust, fear, dependency (5 dimensions)
 *  - incident memory (what happened and when)
 *  - contact frequency tracking (for abandonment anxiety)
 *  - attachment-style-weighted event processing
 */

import type {
  PsychRelationship,
  RelationshipEventType,
  RelationshipEventImpact,
  RelationshipIncident,
  AttachmentEventModifiers,
} from '../../types/diplomacy-v2.js';
import { ATTACHMENT_EVENT_MODIFIERS } from '../../types/diplomacy-v2.js';
import type {
  RolledPersonality,
  AttachmentStyle,
  AffinityMatrix,
} from '../../types/psychology.js';
import { computeCompatibility, lookupBaseAffinity } from './compatibility.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum incidents stored per relationship. */
const MAX_INCIDENTS = 50;

/** Per-tick decay rate for positive history. */
const POSITIVE_HISTORY_DECAY = 0.002;

/** Per-tick decay rate for negative history (slower — grudges linger). */
const NEGATIVE_HISTORY_DECAY = 0.001;

/** Contact frequency decay per tick (rolling average). */
const CONTACT_FREQ_DECAY = 0.98;

/** Ticks of no contact before abandonment anxiety starts rising. */
const ABANDONMENT_THRESHOLD = 50;

// ---------------------------------------------------------------------------
// Relationship event catalogue
// ---------------------------------------------------------------------------

/**
 * Pre-defined base impacts for each relationship event type.
 * These are RAW values before attachment-style modifiers.
 */
export const RELATIONSHIP_EVENTS: Record<RelationshipEventType, RelationshipEventImpact> = {
  // Positive events
  trade_treaty:            { warmth: 5,  respect: 3,  trust: 5,   fear: 0,   dependency: 3 },
  non_aggression_treaty:   { warmth: 3,  respect: 2,  trust: 8,   fear: -2,  dependency: 2 },
  research_treaty:         { warmth: 4,  respect: 5,  trust: 5,   fear: 0,   dependency: 3 },
  mutual_defence_treaty:   { warmth: 8,  respect: 8,  trust: 10,  fear: -3,  dependency: 8 },
  alliance_treaty:         { warmth: 12, respect: 10, trust: 15,  fear: -5,  dependency: 12 },
  gift_received:           { warmth: 8,  respect: 2,  trust: 3,   fear: 0,   dependency: 1 },
  praise_given:            { warmth: 3,  respect: 5,  trust: 1,   fear: 0,   dependency: 0 },
  recognition_given:       { warmth: 2,  respect: 8,  trust: 2,   fear: 0,   dependency: 0 },
  grand_gesture:           { warmth: 15, respect: 10, trust: 5,   fear: 0,   dependency: 3 },
  cultural_exchange:       { warmth: 4,  respect: 4,  trust: 3,   fear: -1,  dependency: 1 },
  defended_in_war:         { warmth: 15, respect: 20, trust: 25,  fear: -5,  dependency: 10 },
  peace_made:              { warmth: 10, respect: 5,  trust: -5,  fear: -10, dependency: 0 },
  trade_route_established: { warmth: 3,  respect: 2,  trust: 3,   fear: 0,   dependency: 5 },
  diplomatic_contact:      { warmth: 1,  respect: 0,  trust: 1,   fear: 0,   dependency: 0 },

  // Negative events
  treaty_broken:           { warmth: -20, respect: -15, trust: -30, fear: 5,   dependency: -5 },
  war_declared:            { warmth: -15, respect: -5,  trust: -20, fear: 10,  dependency: -5 },
  war_declared_on_us:      { warmth: -30, respect: -10, trust: -40, fear: 20,  dependency: -10 },
  conquered_friend:        { warmth: -10, respect: -5,  trust: -15, fear: 15,  dependency: 0 },
  enslaved_species:        { warmth: -25, respect: -20, trust: -20, fear: 10,  dependency: 0 },
  ignored_request:         { warmth: -5,  respect: -3,  trust: -5,  fear: 0,   dependency: -2 },
  insult:                  { warmth: -10, respect: -10, trust: -5,  fear: 0,   dependency: 0 },
  threat:                  { warmth: -8,  respect: -3,  trust: -10, fear: 15,  dependency: 0 },
  request_denied:          { warmth: -3,  respect: -2,  trust: -3,  fear: 0,   dependency: -1 },
  border_violation:        { warmth: -5,  respect: -8,  trust: -10, fear: 8,   dependency: 0 },
  espionage_detected:      { warmth: -10, respect: -5,  trust: -20, fear: 5,   dependency: 0 },
};

// ---------------------------------------------------------------------------
// Relationship creation
// ---------------------------------------------------------------------------

/**
 * Create a new relationship between two empires at first contact.
 * Initial dimensions are seeded from personality compatibility and
 * species-pair affinity, plus the first-contact attitude.
 */
export function createRelationship(
  targetEmpireId: string,
  ourPersonality: RolledPersonality,
  theirPersonality: RolledPersonality,
  affinityMatrix: AffinityMatrix,
  currentTick: number,
): PsychRelationship {
  const compat = computeCompatibility(ourPersonality, theirPersonality);
  const baseAffinity = lookupBaseAffinity(
    affinityMatrix,
    ourPersonality.speciesId,
    theirPersonality.speciesId,
  );

  // Seed warmth from first-contact attitude + affinity
  const initialWarmth = clampDim(
    ourPersonality.firstContactAttitude + Math.round(baseAffinity * 0.3),
    -100, 100,
  );

  // Seed respect from compatibility (similar species respect each other)
  const initialRespect = clampDim(Math.round(compat * 0.2), -100, 100);

  // Trust starts low — must be earned
  const initialTrust = clampDim(20 + Math.round(baseAffinity * 0.2), 0, 100);

  return {
    targetEmpireId,
    warmth: initialWarmth,
    respect: initialRespect,
    trust: initialTrust,
    fear: 0,
    dependency: 0,
    compatibility: compat,
    dynamicAffinity: 0,
    incidents: [],
    positiveHistory: 0,
    negativeHistory: 0,
    lastContactTick: currentTick,
    contactFrequency: 0,
    abandonmentAnxiety: 0,
    establishedTick: currentTick,
  };
}

// ---------------------------------------------------------------------------
// Event processing
// ---------------------------------------------------------------------------

/**
 * Apply a relationship event, modified by the receiver's attachment style.
 * Records the incident and updates history accumulators.
 */
export function applyRelationshipEvent(
  rel: PsychRelationship,
  eventType: RelationshipEventType,
  attachmentStyle: AttachmentStyle,
  currentTick: number,
  agreeableness: number = 50,
): PsychRelationship {
  const baseImpact = RELATIONSHIP_EVENTS[eventType];
  if (!baseImpact) return rel;

  const mods = ATTACHMENT_EVENT_MODIFIERS[attachmentStyle];
  const result = { ...rel };

  // Apply attachment-modified impacts
  const warmthDelta = Math.round(baseImpact.warmth * mods.warmthMultiplier);
  const respectDelta = baseImpact.respect;
  const trustDelta = Math.round(baseImpact.trust * mods.trustMultiplier);
  const fearDelta = Math.round(baseImpact.fear * mods.fearMultiplier);
  const depDelta = baseImpact.dependency;

  result.warmth     = clampDim(result.warmth + warmthDelta, -100, 100);
  result.respect    = clampDim(result.respect + respectDelta, -100, 100);
  result.trust      = clampDim(result.trust + trustDelta, 0, 100);
  result.fear       = clampDim(result.fear + fearDelta, 0, 100);
  result.dependency = clampDim(result.dependency + depDelta, 0, 100);

  // Enslaved species has extra penalty for high-agreeableness species
  if (eventType === 'enslaved_species' && agreeableness > 60) {
    const extraPenalty = Math.round((agreeableness - 60) * 0.5);
    result.warmth = clampDim(result.warmth - extraPenalty, -100, 100);
    result.respect = clampDim(result.respect - extraPenalty, -100, 100);
  }

  // Record incident
  const incident: RelationshipIncident = {
    tick: currentTick,
    type: eventType,
    warmthImpact: warmthDelta,
    respectImpact: respectDelta,
    trustImpact: trustDelta,
    fearImpact: fearDelta,
  };
  result.incidents = [...result.incidents, incident].slice(-MAX_INCIDENTS);

  // Update history accumulators
  const isPositive = warmthDelta > 0 || trustDelta > 0;
  if (isPositive) {
    result.positiveHistory += Math.abs(warmthDelta) + Math.abs(trustDelta);
  } else {
    result.negativeHistory += Math.abs(warmthDelta) + Math.abs(trustDelta);
    // Avoidant types accumulate grievances silently
    if (attachmentStyle === 'avoidant') {
      result.negativeHistory += Math.abs(warmthDelta) * (mods.grievanceMultiplier - 1);
    }
  }

  // Update contact tracking
  result.lastContactTick = currentTick;
  result.contactFrequency += 1;

  // Ignored request has special abandonment impact
  if (eventType === 'ignored_request') {
    result.abandonmentAnxiety = clampDim(
      result.abandonmentAnxiety + Math.round(5 * mods.abandonmentMultiplier),
      0, 100,
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// Per-tick relationship maintenance
// ---------------------------------------------------------------------------

/**
 * Process one tick of relationship decay and contact tracking.
 * Call once per tick per relationship.
 */
export function tickRelationship(
  rel: PsychRelationship,
  attachmentStyle: AttachmentStyle,
  currentTick: number,
): PsychRelationship {
  const result = { ...rel };

  // Decay history accumulators
  result.positiveHistory = Math.max(0, result.positiveHistory * (1 - POSITIVE_HISTORY_DECAY));
  result.negativeHistory = Math.max(0, result.negativeHistory * (1 - NEGATIVE_HISTORY_DECAY));

  // Decay contact frequency (rolling average)
  result.contactFrequency = result.contactFrequency * CONTACT_FREQ_DECAY;

  // Update abandonment anxiety based on contact gap
  const ticksSinceContact = currentTick - result.lastContactTick;
  const mods = ATTACHMENT_EVENT_MODIFIERS[attachmentStyle];

  if (ticksSinceContact > ABANDONMENT_THRESHOLD) {
    // Anxiety rises based on attachment style
    const anxietyRise = Math.round(
      ((ticksSinceContact - ABANDONMENT_THRESHOLD) / 100) * mods.abandonmentMultiplier,
    );
    result.abandonmentAnxiety = clampDim(result.abandonmentAnxiety + anxietyRise, 0, 100);
  } else {
    // Anxiety slowly decays when in regular contact
    result.abandonmentAnxiety = clampDim(
      Math.round(result.abandonmentAnxiety * 0.95),
      0, 100,
    );
  }

  // Slow warmth/trust drift based on history balance
  const historyBalance = result.positiveHistory - result.negativeHistory;
  if (Math.abs(historyBalance) > 10) {
    const drift = Math.sign(historyBalance) * 0.1;
    result.warmth = clampDim(Math.round(result.warmth + drift), -100, 100);
    result.trust = clampDim(Math.round(result.trust + drift * 0.5), 0, 100);
  }

  // Fear decays slowly toward 0 when no threatening events
  if (result.fear > 0) {
    result.fear = clampDim(Math.round(result.fear * 0.99), 0, 100);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Derived metrics
// ---------------------------------------------------------------------------

/**
 * Compute overall relationship sentiment as a single value for compatibility
 * with existing systems that expect a single attitude number.
 * Weighted combination of dimensions.
 */
export function computeOverallSentiment(rel: PsychRelationship): number {
  return Math.round(
    rel.warmth * 0.35 +
    rel.respect * 0.20 +
    rel.trust * 0.30 +   // trust is 0-100, scale to match
    rel.fear * -0.15 +
    rel.compatibility * 0.10 +
    rel.dynamicAffinity * 0.10,
  );
}

/**
 * Check if a relationship has deteriorated enough to be considered hostile.
 * Uses multiple dimensions, not just a single threshold.
 */
export function isRelationshipHostile(rel: PsychRelationship): boolean {
  return rel.warmth < -30 && rel.trust < 20 && rel.fear > 30;
}

/**
 * Check if a relationship is strong enough for alliance consideration.
 */
export function isRelationshipAllianceReady(rel: PsychRelationship): boolean {
  return rel.warmth > 40 && rel.trust > 50 && rel.respect > 20;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clampDim(value: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, value)));
}
