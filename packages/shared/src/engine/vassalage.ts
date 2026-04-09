/**
 * Vassalage engine — pure functions for overlord/vassal mechanics.
 *
 * Handles tribute calculation, resource transfers, relationship queries,
 * and diplomatic action restrictions for vassal empires.
 *
 * All functions are side-effect free.
 */

import type { EmpireResources } from '../types/resources.js';
import type { DiplomacyState } from './diplomacy.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Tribute rate: vassal pays this fraction of their income to overlord per tick. */
export const VASSAL_TRIBUTE_RATE = 0.15; // 15% of vassal's income

/** Vassal gets this multiplier on overlord's research output (tech sharing). */
export const VASSAL_RESEARCH_BONUS = 0.10; // 10% of overlord's research

/** Overlord gets this combat bonus when fighting alongside vassal. */
export const OVERLORD_COMBAT_BONUS = 0.05; // +5% combat effectiveness

// ---------------------------------------------------------------------------
// Tribute
// ---------------------------------------------------------------------------

/**
 * Calculate tribute payment from vassal to overlord.
 * Returns the credit amount to transfer (always >= 0, rounded).
 */
export function calculateTribute(
  vassalIncome: number,
  tributeRate: number = VASSAL_TRIBUTE_RATE,
): number {
  return Math.max(0, Math.round(vassalIncome * tributeRate));
}

/**
 * Apply tribute transfer: deduct from vassal, add to overlord.
 * Returns updated resources for both. Never deducts more than the vassal holds.
 * Does not mutate the original objects.
 */
export function applyTribute(
  vassalResources: EmpireResources,
  overlordResources: EmpireResources,
  tributeAmount: number,
): { vassal: EmpireResources; overlord: EmpireResources } {
  const actualTribute = Math.min(tributeAmount, Math.max(0, vassalResources.credits));
  return {
    vassal: { ...vassalResources, credits: vassalResources.credits - actualTribute },
    overlord: { ...overlordResources, credits: overlordResources.credits + actualTribute },
  };
}

// ---------------------------------------------------------------------------
// Relationship queries
// ---------------------------------------------------------------------------

/** A resolved overlord-vassal pair. */
export interface VassalRelationship {
  overlordId: string;
  vassalId: string;
}

/**
 * Find all vassalage relationships in the active diplomacy state.
 *
 * Convention: a `vassalism` treaty is stored symmetrically on both sides of
 * a relation (as `proposeTreaty` does). The `terms.isOverlord` field
 * distinguishes the two sides:
 *  - `isOverlord = 1` on the overlord's relation toward the vassal
 *  - `isOverlord = 0` on the vassal's relation toward the overlord
 *
 * We only emit a relationship when we encounter the overlord's side
 * (`isOverlord === 1`), which gives us exactly one entry per vassalage.
 */
export function findVassalRelationships(
  state: DiplomacyState,
): VassalRelationship[] {
  const results: VassalRelationship[] = [];

  for (const [empireId, targets] of state.relations) {
    for (const [targetId, rel] of targets) {
      for (const treaty of rel.treaties) {
        if (treaty.type !== 'vassalism') continue;

        // Only process from the overlord's side to avoid double-counting.
        if (treaty.terms && treaty.terms['isOverlord'] === 1) {
          results.push({ overlordId: empireId, vassalId: targetId });
        }
      }
    }
  }

  return results;
}

/**
 * Check if an empire is a vassal (has an active vassalism treaty where they are the subject).
 */
export function isVassal(
  empireId: string,
  vassalRelationships: VassalRelationship[],
): boolean {
  return vassalRelationships.some(r => r.vassalId === empireId);
}

/**
 * Check if an empire is an overlord.
 */
export function isOverlord(
  empireId: string,
  vassalRelationships: VassalRelationship[],
): boolean {
  return vassalRelationships.some(r => r.overlordId === empireId);
}

/**
 * Get the overlord of a vassal empire. Returns null if not a vassal.
 */
export function getOverlord(
  empireId: string,
  vassalRelationships: VassalRelationship[],
): string | null {
  const rel = vassalRelationships.find(r => r.vassalId === empireId);
  return rel?.overlordId ?? null;
}

/**
 * Get all vassals of an overlord.
 */
export function getVassals(
  empireId: string,
  vassalRelationships: VassalRelationship[],
): string[] {
  return vassalRelationships
    .filter(r => r.overlordId === empireId)
    .map(r => r.vassalId);
}

// ---------------------------------------------------------------------------
// Diplomatic action restrictions
// ---------------------------------------------------------------------------

/**
 * Check if a vassal action is restricted.
 *
 * Vassals cannot:
 *  - Declare war on their overlord
 *  - Declare war on their overlord's allies
 *  - (Rebellion is required to break a vassalism treaty unilaterally)
 */
export function isVassalActionRestricted(
  action: string,
  _vassalId: string,
  targetId: string,
  overlordId: string,
  overlordAllies: string[],
): boolean {
  if (action === 'declare_war') {
    // Cannot declare war on overlord or overlord's allies
    return targetId === overlordId || overlordAllies.includes(targetId);
  }
  // Other actions are not restricted by default
  return false;
}
