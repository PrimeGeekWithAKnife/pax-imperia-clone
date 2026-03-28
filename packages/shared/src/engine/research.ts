/**
 * Research engine — pure functions for technology research management.
 *
 * All functions are side-effect-free. Game state must be updated by the caller
 * using the values returned from these functions.
 */

import type { Empire, Species, TechAge } from '../types/species.js';
import type { Technology, TechEffect } from '../types/technology.js';
import { TECH_AGES } from '../constants/game.js';
import { GOVERNMENTS } from '../types/government.js';

export type { Technology, TechEffect };

// ---------------------------------------------------------------------------
// Research state types
// ---------------------------------------------------------------------------

export interface ActiveResearch {
  techId: string;
  pointsInvested: number;
  /** Percentage of available research points to apply each tick (0–100). */
  allocation: number;
}

export interface ResearchState {
  /** IDs of successfully researched technologies. */
  completedTechs: string[];
  /** Technologies currently being researched. */
  activeResearch: ActiveResearch[];
  /** Queued tech IDs — promoted to active when a slot opens. */
  researchQueue?: string[];
  currentAge: TechAge;
  totalResearchGenerated: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the index of a TechAge in the progression order, or -1 if unknown. */
function ageIndex(age: TechAge | string): number {
  return TECH_AGES.findIndex(a => a.name === age);
}

/**
 * Returns whether the given age is accessible from the current age.
 * A tech can only be researched if its age index is <= the current age index.
 */
function isAgeAccessible(techAge: string, currentAge: TechAge): boolean {
  const techIdx = ageIndex(techAge);
  const currentIdx = ageIndex(currentAge);
  // Unknown ages are treated as always accessible (forward-compatible)
  if (techIdx === -1 || currentIdx === -1) return true;
  return techIdx <= currentIdx;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns all technologies that are currently available to research.
 *
 * A tech is available when:
 * - All of its prerequisites are in completedTechs
 * - It is not already completed
 * - It is not already in activeResearch
 * - Its age gate is satisfied (tech's age index <= current age index)
 * - If the tech has a speciesId, it matches the empire's species
 */
export function getAvailableTechs(
  allTechs: Technology[],
  state: ResearchState,
  speciesId?: string,
): Technology[] {
  const completedSet = new Set(state.completedTechs);
  const activeSet = new Set(state.activeResearch.map(r => r.techId));

  return allTechs.filter(tech => {
    if (completedSet.has(tech.id)) return false;
    if (activeSet.has(tech.id)) return false;
    if (!isAgeAccessible(tech.age, state.currentAge)) return false;
    if (tech.speciesId && speciesId && tech.speciesId !== speciesId) return false;
    return tech.prerequisites.every(prereqId => completedSet.has(prereqId));
  });
}

/**
 * Begins researching a technology, adding it to activeResearch.
 *
 * Throws if:
 * - The tech is not in the available tech list
 * - The requested allocation would push the total above 100%
 * - The number of active projects would exceed the research lab count
 *
 * @param state       Current research state.
 * @param techId      ID of the technology to start.
 * @param allocation  Percentage of research points to allocate (0–100).
 * @param speciesId   Optional species ID for filtering species-specific techs.
 * @param researchLabCount  Number of research labs the empire has (limits simultaneous projects). 0 = unlimited (legacy).
 */
export function startResearch(
  state: ResearchState,
  techId: string,
  allTechs: Technology[],
  allocation: number,
  speciesId?: string,
  researchLabCount = 0,
): ResearchState {
  const available = getAvailableTechs(allTechs, state, speciesId);
  const tech = available.find(t => t.id === techId);

  if (!tech) {
    throw new Error(
      `Cannot start research on "${techId}": tech is not available (prerequisites unmet, already completed, or age-gated)`,
    );
  }

  // Enforce research lab limit: 1 active project per lab
  if (researchLabCount > 0 && state.activeResearch.length >= researchLabCount) {
    throw new Error(
      `Cannot start research on "${techId}": all ${researchLabCount} research lab(s) are occupied (${state.activeResearch.length} active projects)`,
    );
  }

  const newEntry: ActiveResearch = {
    techId,
    pointsInvested: 0,
    allocation: 0, // will be set by the even split below
  };

  // Auto-redistribute allocation evenly across all active projects (including the new one)
  const redistributed = redistributeAllocation([...state.activeResearch, newEntry]);

  // Remove from queue if it was queued
  const queue = state.researchQueue ?? [];

  return {
    ...state,
    activeResearch: redistributed,
    researchQueue: queue.filter(id => id !== techId),
  };
}

/**
 * Add a technology to the research queue. Queued techs are promoted to active
 * slots automatically when a project completes and a lab slot opens.
 */
export function queueResearch(
  state: ResearchState,
  techId: string,
  allTechs: Technology[],
  speciesId?: string,
): ResearchState {
  const available = getAvailableTechs(allTechs, state, speciesId);
  const tech = available.find(t => t.id === techId);
  if (!tech) {
    throw new Error(
      `Cannot queue research on "${techId}": tech is not available`,
    );
  }

  const queue = state.researchQueue ?? [];
  if (queue.includes(techId)) {
    throw new Error(`"${techId}" is already in the research queue`);
  }
  if (state.activeResearch.some(r => r.techId === techId)) {
    throw new Error(`"${techId}" is already being actively researched`);
  }

  return {
    ...state,
    researchQueue: [...queue, techId],
  };
}

/**
 * Remove a technology from the research queue.
 */
export function dequeueResearch(
  state: ResearchState,
  techId: string,
): ResearchState {
  const queue = state.researchQueue ?? [];
  return {
    ...state,
    researchQueue: queue.filter(id => id !== techId),
  };
}

/** Redistribute allocation evenly across active research projects. */
export function redistributeAllocation(active: ActiveResearch[]): ActiveResearch[] {
  if (active.length === 0) return active;
  const evenShare = Math.floor(100 / active.length);
  const rem = 100 - evenShare * active.length;
  return active.map((r, i) => ({
    ...r,
    allocation: evenShare + (i === 0 ? rem : 0),
  }));
}

/**
 * Updates the allocation percentages for all active research projects.
 *
 * The allocations array should cover every active project (missing entries
 * default to 0). The sum of all allocations must not exceed 100%.
 *
 * @param state        Current research state.
 * @param allocations  Array of { techId, allocation } pairs.
 */
export function setResearchAllocation(
  state: ResearchState,
  allocations: { techId: string; allocation: number }[],
): ResearchState {
  const allocationMap = new Map(allocations.map(a => [a.techId, a.allocation]));

  const total = allocations.reduce((sum, a) => sum + a.allocation, 0);
  if (total > 100) {
    throw new Error(
      `Total research allocation ${total}% exceeds 100%`,
    );
  }

  const updatedActive = state.activeResearch.map(r => ({
    ...r,
    allocation: allocationMap.get(r.techId) ?? 0,
  }));

  return {
    ...state,
    activeResearch: updatedActive,
  };
}

/**
 * Processes one research tick, distributing research points across active
 * projects according to their allocation percentages.
 *
 * Species research bonus: effective points = researchPointsGenerated * (species.traits.research / 5)
 * Trait 5 = normal rate, 10 = double, 1 = one-fifth.
 * Government researchSpeed multiplier is applied on top.
 *
 * @returns Updated state (with completed techs removed from activeResearch and
 *          added to completedTechs) and the list of Technology objects that
 *          completed this tick.
 */
export function processResearchTick(
  state: ResearchState,
  researchPointsGenerated: number,
  species: Species,
  allTechs: Technology[],
  empire?: Empire,
): { newState: ResearchState; completed: Technology[] } {
  const speciesBonus = species.traits.research / 5;
  const govDef = empire ? GOVERNMENTS[empire.government] : undefined;
  const govResearchMultiplier = govDef?.modifiers.researchSpeed ?? 1.0;
  const effectivePoints = researchPointsGenerated * speciesBonus * govResearchMultiplier;

  const techMap = new Map(allTechs.map(t => [t.id, t]));

  let completedTechs: string[] = [...state.completedTechs];
  const completedThisTick: Technology[] = [];
  const remainingActive: ActiveResearch[] = [];

  for (const active of state.activeResearch) {
    const tech = techMap.get(active.techId);
    if (!tech) {
      // Unknown tech — leave as-is
      remainingActive.push(active);
      continue;
    }

    const pointsThisTick = effectivePoints * (active.allocation / 100);
    const newPointsInvested = active.pointsInvested + pointsThisTick;

    if (newPointsInvested >= tech.cost) {
      // Tech complete
      completedTechs = [...completedTechs, tech.id];
      completedThisTick.push(tech);
    } else {
      remainingActive.push({
        ...active,
        pointsInvested: newPointsInvested,
      });
    }
  }

  // Determine the new current age after all completions
  let newAge = state.currentAge;
  for (const tech of completedThisTick) {
    for (const effect of tech.effects) {
      if (effect.type === 'age_unlock') {
        const candidateAge = effect.age as TechAge;
        const candidateIdx = ageIndex(candidateAge);
        const currentIdx = ageIndex(newAge);
        if (candidateIdx > currentIdx) {
          newAge = candidateAge;
        }
      }
    }
  }

  // Promote queued techs to active slots to replace completed ones
  let queue = [...(state.researchQueue ?? [])];
  let finalActive = [...remainingActive];
  const maxActive = state.activeResearch.length; // maintain the same slot count
  while (finalActive.length < maxActive && queue.length > 0) {
    const nextTechId = queue.shift()!;
    // Verify the queued tech is still available (prereqs may have changed)
    const nextTech = techMap.get(nextTechId);
    if (nextTech && !completedTechs.includes(nextTechId)) {
      finalActive.push({ techId: nextTechId, pointsInvested: 0, allocation: 0 });
    }
  }

  // Redistribute allocation evenly across all remaining + newly promoted projects
  if (completedThisTick.length > 0 || finalActive.length !== remainingActive.length) {
    finalActive = redistributeAllocation(finalActive);
  }

  const newState: ResearchState = {
    completedTechs,
    activeResearch: finalActive,
    researchQueue: queue,
    currentAge: newAge,
    totalResearchGenerated: state.totalResearchGenerated + effectivePoints,
  };

  return { newState, completed: completedThisTick };
}

/**
 * Returns whether all prerequisites for a given age gate tech are satisfied,
 * meaning the empire can transition to that age.
 *
 * The age gate tech is identified by having an `age_unlock` effect for the
 * target age. If no such tech exists, returns false (unknown gate = not passable).
 */
export function canAdvanceAge(
  state: ResearchState,
  targetAge: TechAge,
  allTechs: Technology[],
): boolean {
  // Find the tech that unlocks the target age
  const gateTech = allTechs.find(tech =>
    tech.effects.some(e => e.type === 'age_unlock' && (e as { type: 'age_unlock'; age: string }).age === targetAge),
  );

  if (!gateTech) return false;

  const completedSet = new Set(state.completedTechs);
  return gateTech.prerequisites.every(prereqId => completedSet.has(prereqId));
}

/**
 * Returns the estimated number of ticks to complete a technology.
 *
 * @param techCost          Total research points required.
 * @param allocation        Percentage of research points allocated (0–100).
 * @param researchPerTick   Base research points generated per tick.
 * @param speciesBonus      Species research multiplier (species.traits.research / 5).
 */
export function getResearchSpeed(
  techCost: number,
  allocation: number,
  researchPerTick: number,
  speciesBonus: number,
): number {
  const effectivePerTick = researchPerTick * speciesBonus * (allocation / 100);
  if (effectivePerTick <= 0) return Infinity;
  return Math.ceil(techCost / effectivePerTick);
}

/**
 * Applies each of a technology's effects to the empire, returning a new Empire.
 *
 * Effects handled:
 * - stat_bonus:        Records the bonus in empire.researchPoints (as a stand-in
 *                      for a future stat system; extend as stats are formalised).
 * - resource_bonus:    Tracked on the empire object's extended properties when
 *                      available; currently a no-op (no resource multiplier map yet).
 * - unlock_hull:       Not directly stored on Empire (managed by tech id list).
 * - unlock_component:  Not directly stored on Empire (managed by tech id list).
 * - unlock_building:   Not directly stored on Empire (managed by tech id list).
 * - enable_ability:    Not directly stored on Empire (managed by tech id list).
 * - age_unlock:        Advances empire.currentAge if the unlocked age is later.
 *
 * In all cases the tech id is already added to empire.technologies by the caller
 * before this function runs, so hull/component/building lookups can derive
 * availability from empire.technologies.
 */
export function applyTechEffects(empire: Empire, tech: Technology): Empire {
  let updated: Empire = { ...empire };

  for (const effect of tech.effects) {
    switch (effect.type) {
      case 'age_unlock': {
        const candidateAge = effect.age as TechAge;
        const candidateIdx = ageIndex(candidateAge);
        const currentIdx = ageIndex(updated.currentAge);
        if (candidateIdx > currentIdx) {
          updated = { ...updated, currentAge: candidateAge };
        }
        break;
      }

      case 'stat_bonus': {
        // Apply named stat bonuses to the empire.
        // Currently only 'researchPoints' is a top-level numeric field on Empire.
        // Additional stats (combat, construction, etc.) are on species traits,
        // which are immutable here. The bonus is accumulated on the empire's
        // researchPoints field as a per-turn flat bonus when stat === 'research'.
        if (effect.stat === 'research') {
          updated = {
            ...updated,
            researchPoints: updated.researchPoints + effect.value,
          };
        }
        break;
      }

      case 'resource_bonus': {
        // Accumulate resource production multipliers.
        // Multipliers stack multiplicatively: 1.5 * 1.2 = 1.8x total.
        const bonuses = { ...(updated.resourceBonuses ?? {}) };
        const current = bonuses[effect.resource] ?? 1;
        bonuses[effect.resource] = current * effect.multiplier;
        updated = { ...updated, resourceBonuses: bonuses };
        break;
      }

      case 'unlock_hull':
      case 'unlock_component':
      case 'unlock_building':
      case 'enable_ability':
        // Availability is derived from empire.technologies (the list of completed
        // tech IDs). No additional field updates needed here.
        break;
    }
  }

  return updated;
}
