/**
 * Research engine — pure functions for technology research management.
 *
 * All functions are side-effect-free. Game state must be updated by the caller
 * using the values returned from these functions.
 */

import type { Empire, Species, TechAge } from '../types/species.js';
import type { Technology, TechEffect } from '../types/technology.js';
import { TECH_AGES } from '../constants/game.js';

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
 */
export function getAvailableTechs(
  allTechs: Technology[],
  state: ResearchState,
): Technology[] {
  const completedSet = new Set(state.completedTechs);
  const activeSet = new Set(state.activeResearch.map(r => r.techId));

  return allTechs.filter(tech => {
    if (completedSet.has(tech.id)) return false;
    if (activeSet.has(tech.id)) return false;
    if (!isAgeAccessible(tech.age, state.currentAge)) return false;
    return tech.prerequisites.every(prereqId => completedSet.has(prereqId));
  });
}

/**
 * Begins researching a technology, adding it to activeResearch.
 *
 * Throws if:
 * - The tech is not in the available tech list
 * - The requested allocation would push the total above 100%
 *
 * @param state       Current research state.
 * @param techId      ID of the technology to start.
 * @param allocation  Percentage of research points to allocate (0–100).
 */
export function startResearch(
  state: ResearchState,
  techId: string,
  allTechs: Technology[],
  allocation: number,
): ResearchState {
  const available = getAvailableTechs(allTechs, state);
  const tech = available.find(t => t.id === techId);

  if (!tech) {
    throw new Error(
      `Cannot start research on "${techId}": tech is not available (prerequisites unmet, already completed, or age-gated)`,
    );
  }

  const currentTotal = state.activeResearch.reduce((sum, r) => sum + r.allocation, 0);
  if (currentTotal + allocation > 100) {
    throw new Error(
      `Cannot allocate ${allocation}% to "${techId}": total allocation would be ${currentTotal + allocation}% (max 100%)`,
    );
  }

  const newEntry: ActiveResearch = {
    techId,
    pointsInvested: 0,
    allocation,
  };

  return {
    ...state,
    activeResearch: [...state.activeResearch, newEntry],
  };
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
): { newState: ResearchState; completed: Technology[] } {
  const speciesBonus = species.traits.research / 5;
  const effectivePoints = researchPointsGenerated * speciesBonus;

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

  const newState: ResearchState = {
    completedTechs,
    activeResearch: remainingActive,
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

      case 'resource_bonus':
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
