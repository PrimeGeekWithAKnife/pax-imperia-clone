/**
 * Psychology-Driven Relationship Model
 *
 * Replaces the flat attitude/trust diplomacy with multi-dimensional
 * relationship state driven by personality psychology.
 *
 * Core dimensions: warmth, respect, trust, fear, dependency
 * Memory: incidents, grievances, accumulated history
 * Attachment: contact tracking, abandonment anxiety
 */

import type { AttachmentStyle } from './psychology.js';

// ---------------------------------------------------------------------------
// Relationship state
// ---------------------------------------------------------------------------

/**
 * Multi-dimensional relationship between two empires.
 * Replaces the single attitude + trust model.
 */
export interface PsychRelationship {
  /** Empire this relationship is WITH. */
  targetEmpireId: string;

  // ── Core dimensions ──────────────────────────────────────────────────────

  /** Coldness ↔ affection. -100 to +100. */
  warmth: number;
  /** Contempt ↔ admiration. -100 to +100. */
  respect: number;
  /** Suspicion ↔ confidence. 0-100. */
  trust: number;
  /** Indifferent ↔ terrified. 0-100. */
  fear: number;
  /** Self-sufficient ↔ deeply reliant. 0-100. */
  dependency: number;

  // ── Computed ──────────────────────────────────────────────────────────────

  /** Personality-based compatibility. -100 to +100. Set at relationship creation. */
  compatibility: number;
  /** Dynamic affinity modifier on top of species-pair base. Evolves with events. */
  dynamicAffinity: number;

  // ── Memory ───────────────────────────────────────────────────────────────

  /** Timestamped events that shaped this relationship. Capped to most recent 50. */
  incidents: RelationshipIncident[];
  /** Accumulated positive interaction weight (decays slowly). */
  positiveHistory: number;
  /** Accumulated negative interaction weight (decays very slowly). */
  negativeHistory: number;

  // ── Contact tracking ─────────────────────────────────────────────────────

  /** Tick of last diplomatic interaction (treaty, gift, praise, message). */
  lastContactTick: number;
  /** Rolling average of interactions per 100 ticks. */
  contactFrequency: number;
  /** For anxious types: rises when contact drops below expected frequency. 0-100. */
  abandonmentAnxiety: number;

  // ── Meta ──────────────────────────────────────────────────────────────────

  /** Tick this relationship was established (first contact). */
  establishedTick: number;
}

// ---------------------------------------------------------------------------
// Relationship incidents
// ---------------------------------------------------------------------------

/** A recorded event that shaped a relationship. */
export interface RelationshipIncident {
  /** Game tick when this occurred. */
  tick: number;
  /** Type of event. */
  type: RelationshipEventType;
  /** Net impact on warmth. */
  warmthImpact: number;
  /** Net impact on respect. */
  respectImpact: number;
  /** Net impact on trust. */
  trustImpact: number;
  /** Net impact on fear. */
  fearImpact: number;
}

// ---------------------------------------------------------------------------
// Relationship events
// ---------------------------------------------------------------------------

/** Categories of events that affect relationships. */
export type RelationshipEventType =
  | 'trade_treaty'
  | 'non_aggression_treaty'
  | 'research_treaty'
  | 'mutual_defence_treaty'
  | 'alliance_treaty'
  | 'gift_received'
  | 'praise_given'
  | 'recognition_given'
  | 'grand_gesture'
  | 'cultural_exchange'
  | 'treaty_broken'
  | 'war_declared'
  | 'war_declared_on_us'
  | 'peace_made'
  | 'defended_in_war'
  | 'conquered_friend'
  | 'enslaved_species'
  | 'ignored_request'
  | 'insult'
  | 'threat'
  | 'request_denied'
  | 'border_violation'
  | 'espionage_detected'
  | 'trade_route_established'
  | 'diplomatic_contact';

/**
 * Base impact of a relationship event on the five dimensions.
 * These are the RAW values before attachment-style modifiers.
 */
export interface RelationshipEventImpact {
  warmth: number;
  respect: number;
  trust: number;
  fear: number;
  dependency: number;
}

// ---------------------------------------------------------------------------
// Attachment modifiers on relationship events
// ---------------------------------------------------------------------------

/**
 * Multipliers applied to event impacts based on the receiver's attachment style.
 */
export interface AttachmentEventModifiers {
  /** Multiplier on warmth changes. */
  warmthMultiplier: number;
  /** Multiplier on trust changes. */
  trustMultiplier: number;
  /** Multiplier on fear changes. */
  fearMultiplier: number;
  /** Extra abandonment anxiety when ignored/contact drops. */
  abandonmentMultiplier: number;
  /** How much negative events add to grievance accumulation. */
  grievanceMultiplier: number;
}

/** Attachment style modifiers for relationship event processing. */
export const ATTACHMENT_EVENT_MODIFIERS: Record<AttachmentStyle, AttachmentEventModifiers> = {
  secure:           { warmthMultiplier: 1.0, trustMultiplier: 1.0, fearMultiplier: 1.0, abandonmentMultiplier: 0.5, grievanceMultiplier: 0.8 },
  anxious:          { warmthMultiplier: 2.0, trustMultiplier: 1.5, fearMultiplier: 1.5, abandonmentMultiplier: 3.0, grievanceMultiplier: 1.0 },
  avoidant:         { warmthMultiplier: 0.5, trustMultiplier: 0.5, fearMultiplier: 0.3, abandonmentMultiplier: 0.2, grievanceMultiplier: 2.0 },
  fearful_avoidant: { warmthMultiplier: 1.5, trustMultiplier: 1.0, fearMultiplier: 2.0, abandonmentMultiplier: 2.0, grievanceMultiplier: 1.5 },
};

// ---------------------------------------------------------------------------
// Relationship dimension keys
// ---------------------------------------------------------------------------

/** Relationship dimension keys for iteration. */
export type RelationshipDimensionKey = 'warmth' | 'respect' | 'trust' | 'fear' | 'dependency';
