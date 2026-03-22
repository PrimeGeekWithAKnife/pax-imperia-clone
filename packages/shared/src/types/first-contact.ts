/**
 * First contact event system.
 * When two species meet for the first time, choices determine the relationship.
 *
 * Without Xenolinguistics on at least one side, anything can happen — greetings
 * may be interpreted as threats, silence as cowardice, and posturing as war.
 * Once communication is possible, outcomes become more predictable but never
 * guaranteed.
 */

import type { CommunicationLevel } from './species.js';

/**
 * The approach the initiating empire takes when encountering an unknown species.
 */
export type FirstContactApproach =
  | 'send_greeting'        // Attempt friendly communication
  | 'observe_silently'     // Watch without revealing yourself
  | 'display_strength'     // Military posturing — "we are powerful"
  | 'open_fire'            // Immediate hostility
  | 'flee'                 // Withdraw immediately
  | 'broadcast_language';  // Send linguistic data (requires xenolinguistics)

/**
 * How the target species reacts to the initiator's approach.
 * Influenced by the target's personality profile and species traits.
 */
export type FirstContactReaction =
  | 'friendly_response'       // They're happy to meet you
  | 'cautious_interest'       // Interested but wary
  | 'confusion'               // They don't understand what's happening
  | 'fear_and_retreat'        // They flee
  | 'hostile_response'        // They attack
  | 'total_misunderstanding'  // Your greeting was interpreted as a threat
  | 'religious_awe'           // They think you're divine (Orivani encountering advanced species)
  | 'assimilation_offer';     // They offer to merge (Nexari, Vethara)

/**
 * A first contact event captures everything about the moment two species meet.
 */
export interface FirstContactEvent {
  id: string;
  initiatorEmpireId: string;
  targetEmpireId: string;
  systemId: string;
  tick: number;
  approach: FirstContactApproach;
  reaction: FirstContactReaction;
  /** Whether the initiator has researched xenolinguistics */
  initiatorHasXenolinguistics: boolean;
  /** Whether the target has researched xenolinguistics */
  targetHasXenolinguistics: boolean;
  /** Resulting relationship status */
  outcome: FirstContactOutcome;
}

/**
 * The concrete outcome of a first contact event, determining the initial
 * diplomatic relationship between two species.
 */
export interface FirstContactOutcome {
  /** Whether a diplomatic relationship has been established */
  relationshipEstablished: boolean;
  /** Initial attitude score, ranging from -100 (hostile) to +100 (friendly) */
  initialAttitude: number;
  /** Whether war was declared as a result of this contact */
  warDeclared: boolean;
  /** Whether trade channels were opened */
  tradeOpened: boolean;
  /** The level of communication achieved */
  communicationLevel: CommunicationLevel;
}

/**
 * Determine the AI reaction to a first contact approach.
 * Based on the AI's personality profile and species traits.
 *
 * Implementation lives in `engine/first-contact.ts`.
 */
export type ResolveFirstContactFn = (
  approach: FirstContactApproach,
  initiatorSpeciesId: string,
  targetSpeciesId: string,
  initiatorHasXenolinguistics: boolean,
  targetHasXenolinguistics: boolean,
  targetPersonalityOpenness: number,   // 1-10
  targetPersonalityBravery: number,    // 1-10
) => FirstContactReaction;
