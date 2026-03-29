/**
 * Narrative event chain engine — pure functions for managing multi-step
 * exploration stories that branch based on player choice and species.
 *
 * All functions are side-effect free. Callers must persist the returned
 * state and events to their own game state records.
 *
 * Design goals:
 *  - Hand-crafted chains with compelling, branching narratives
 *  - Species-specific branches (Vaelori psionic, Pyrenth geological, etc.)
 *  - Competitive chains where multiple empires can race
 *  - Devourer breadcrumb trail through precursor ruin chains
 *  - Quality over quantity — every chain is a self-contained mini-story
 */

import type {
  NarrativeChain,
  NarrativeStep,
  NarrativeChoice,
  NarrativeChainProgress,
  NarrativeChainEvent,
  NarrativeChainCompleteEvent,
  NarrativeReward,
  NarrativeStepOverride,
} from '../types/narrative.js';

import type { AnomalyType } from '../types/anomaly.js';
import type { SpecialAbility } from '../types/species.js';

// Re-export types consumed by game-loop and other engine modules
export type {
  NarrativeChain,
  NarrativeStep,
  NarrativeChoice,
  NarrativeChainProgress,
  NarrativeChainEvent,
  NarrativeChainCompleteEvent,
  NarrativeReward,
} from '../types/narrative.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns narrative chains available to an empire based on their current
 * discovery state, completed chains, species, and technologies.
 *
 * A chain is available when:
 *  1. The empire has discovered at least one anomaly type that triggers it
 *  2. The empire has not already completed (or started) the chain
 *  3. The empire meets minimum discovered anomaly thresholds
 *  4. The empire has the required technologies (if any)
 */
export function getAvailableChains(
  allChains: NarrativeChain[],
  discoveredAnomalyTypes: AnomalyType[],
  completedOrActiveChainIds: string[],
  empireSpeciesId: string,
  empireTechIds: string[],
  totalDiscoveredAnomalies: number,
): NarrativeChain[] {
  return allChains.filter((chain) => {
    // Already completed or in progress
    if (completedOrActiveChainIds.includes(chain.id)) {
      return false;
    }

    // Must have discovered at least one triggering anomaly type
    const hasTrigger = chain.triggerAnomalyTypes.some((t) =>
      discoveredAnomalyTypes.includes(t),
    );
    if (!hasTrigger) {
      return false;
    }

    // Minimum discovery threshold
    if (
      chain.minDiscoveredAnomalies !== undefined &&
      totalDiscoveredAnomalies < chain.minDiscoveredAnomalies
    ) {
      return false;
    }

    // Required technologies
    if (chain.requiredTechs && chain.requiredTechs.length > 0) {
      const hasAllTech = chain.requiredTechs.every((t) =>
        empireTechIds.includes(t),
      );
      if (!hasAllTech) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Starts a new narrative chain for an empire, returning the initial progress
 * record positioned at the first step.
 */
export function startChain(
  chain: NarrativeChain,
  empireId: string,
  currentTick: number,
): NarrativeChainProgress {
  const firstStep = chain.steps[0];
  if (!firstStep) {
    throw new Error(`Narrative chain '${chain.id}' has no steps`);
  }

  return {
    chainId: chain.id,
    empireId,
    currentStepId: firstStep.id,
    choiceHistory: [],
    complete: false,
    startedTick: currentTick,
  };
}

/**
 * Resolves the effective step for a given empire/species, applying any
 * species-specific overrides (additional choices, modified narration, etc.).
 */
export function resolveStep(
  chain: NarrativeChain,
  stepId: string,
  speciesId: string,
): NarrativeStep | null {
  const baseStep = chain.steps.find((s) => s.id === stepId);
  if (!baseStep) {
    return null;
  }

  // Deep-clone the step to avoid mutation
  const step: NarrativeStep = {
    id: baseStep.id,
    title: baseStep.title,
    narration: baseStep.narration,
    choices: [...baseStep.choices],
  };

  // Apply species-specific overrides
  const overrides = chain.speciesBranches[speciesId];
  if (overrides) {
    const override = overrides.find((o) => o.stepId === stepId);
    if (override) {
      // Replace narration if provided
      if (override.narration) {
        step.narration = override.narration;
      }

      // Remove choices marked for removal
      if (override.removedChoiceIds && override.removedChoiceIds.length > 0) {
        step.choices = step.choices.filter(
          (c) => !override.removedChoiceIds!.includes(c.id),
        );
      }

      // Add species-specific choices
      if (override.additionalChoices && override.additionalChoices.length > 0) {
        step.choices = [...step.choices, ...override.additionalChoices];
      }
    }
  }

  return step;
}

/**
 * Returns the list of choices available to an empire at the current step,
 * filtering out choices whose requirements are not met.
 */
export function getAvailableChoices(
  step: NarrativeStep,
  speciesId: string,
  empireTechIds: string[],
  empireResearchPoints: number,
  empireMinerals: number,
  speciesAbilities: SpecialAbility[],
): NarrativeChoice[] {
  return step.choices.filter((choice) => {
    // Species-locked choices
    if (choice.speciesBranch && choice.speciesBranch !== speciesId) {
      return false;
    }

    // Check requirements
    if (choice.requirements) {
      const req = choice.requirements;

      if (req.techIds && req.techIds.length > 0) {
        if (!req.techIds.every((t) => empireTechIds.includes(t))) {
          return false;
        }
      }

      if (
        req.minResearchPoints !== undefined &&
        empireResearchPoints < req.minResearchPoints
      ) {
        return false;
      }

      if (req.minMinerals !== undefined && empireMinerals < req.minMinerals) {
        return false;
      }

      if (req.specialAbility) {
        if (!speciesAbilities.includes(req.specialAbility as SpecialAbility)) {
          return false;
        }
      }
    }

    return true;
  });
}

/** Result of advancing a chain by one step. */
export interface AdvanceChainResult {
  /** Updated progress record. */
  progress: NarrativeChainProgress;
  /** Events emitted by the advance. */
  events: (NarrativeChainEvent | NarrativeChainCompleteEvent)[];
  /** Rewards granted by the chosen option (if any). */
  rewards?: NarrativeReward;
}

/**
 * Advances a narrative chain by applying the player's choice at the current
 * step. Returns the updated progress, any events, and rewards.
 *
 * If the chosen option's `nextStepId` is null, the chain is marked complete.
 */
export function advanceChain(
  chain: NarrativeChain,
  progress: NarrativeChainProgress,
  choiceId: string,
  empireId: string,
  speciesId: string,
  currentTick: number,
): AdvanceChainResult {
  // Resolve the current step with species overrides
  const step = resolveStep(chain, progress.currentStepId, speciesId);
  if (!step) {
    throw new Error(
      `Step '${progress.currentStepId}' not found in chain '${chain.id}'`,
    );
  }

  // Find the selected choice
  const choice = step.choices.find((c) => c.id === choiceId);
  if (!choice) {
    throw new Error(
      `Choice '${choiceId}' not found in step '${step.id}' of chain '${chain.id}'`,
    );
  }

  const events: (NarrativeChainEvent | NarrativeChainCompleteEvent)[] = [];

  // Emit advance event
  const advanceEvent: NarrativeChainEvent = {
    type: 'narrative_chain_advance',
    chainId: chain.id,
    empireId,
    stepId: step.id,
    choiceId,
    rewards: choice.rewards,
    risks: choice.risks,
  };
  events.push(advanceEvent);

  // Update progress
  const updatedProgress: NarrativeChainProgress = {
    ...progress,
    choiceHistory: [
      ...progress.choiceHistory,
      { stepId: step.id, choiceId, tick: currentTick },
    ],
  };

  // Check if this choice ends the chain
  if (choice.nextStepId === null) {
    updatedProgress.complete = true;
    updatedProgress.completedTick = currentTick;
    updatedProgress.outcome = buildOutcomeDescription(chain, updatedProgress);

    // Compute aggregate rewards across all choices
    const totalRewards = aggregateRewards(chain, updatedProgress, speciesId);

    const completeEvent: NarrativeChainCompleteEvent = {
      type: 'narrative_chain_complete',
      chainId: chain.id,
      empireId,
      outcome: updatedProgress.outcome,
      totalRewards,
    };
    events.push(completeEvent);
  } else {
    // Advance to next step
    updatedProgress.currentStepId = choice.nextStepId;
  }

  return {
    progress: updatedProgress,
    events,
    rewards: choice.rewards,
  };
}

/**
 * Checks whether a chain progress record represents a completed chain,
 * and returns the completion status along with the outcome description.
 */
export function checkChainCompletion(
  progress: NarrativeChainProgress,
): { complete: boolean; outcome: string } {
  return {
    complete: progress.complete,
    outcome: progress.outcome ?? 'In progress',
  };
}

/**
 * Returns all lore fragments collected across a chain's choice history.
 */
export function collectLoreFragments(
  chain: NarrativeChain,
  progress: NarrativeChainProgress,
  speciesId: string,
): string[] {
  const fragments: string[] = [];

  for (const entry of progress.choiceHistory) {
    const step = resolveStep(chain, entry.stepId, speciesId);
    if (!step) continue;

    const choice = step.choices.find((c) => c.id === entry.choiceId);
    if (choice?.rewards?.loreFragment) {
      fragments.push(choice.rewards.loreFragment);
    }
  }

  return fragments;
}

/**
 * Returns chains that are tagged as Devourer breadcrumbs, sorted by the
 * minimum discovery requirement (i.e. the intended discovery order).
 */
export function getDevourerBreadcrumbChains(
  allChains: NarrativeChain[],
): NarrativeChain[] {
  return allChains
    .filter((c) => c.tags.includes('breadcrumb'))
    .sort(
      (a, b) => (a.minDiscoveredAnomalies ?? 0) - (b.minDiscoveredAnomalies ?? 0),
    );
}

/**
 * Determines whether a chain is contested — i.e. whether multiple empires
 * are actively pursuing the same competitive chain.
 */
export function isChainContested(
  chain: NarrativeChain,
  allProgress: NarrativeChainProgress[],
): boolean {
  if (!chain.competitive) return false;

  const activeEmpires = allProgress.filter(
    (p) => p.chainId === chain.id && !p.complete,
  );
  return activeEmpires.length > 1;
}

/**
 * For competitive chains, returns the empire IDs of all participants
 * and their current progress (step index within the chain).
 */
export function getCompetitorProgress(
  chain: NarrativeChain,
  allProgress: NarrativeChainProgress[],
): { empireId: string; stepIndex: number; complete: boolean }[] {
  const chainProgress = allProgress.filter((p) => p.chainId === chain.id);

  return chainProgress.map((p) => {
    const stepIndex = chain.steps.findIndex((s) => s.id === p.currentStepId);
    return {
      empireId: p.empireId,
      stepIndex: stepIndex >= 0 ? stepIndex : chain.steps.length,
      complete: p.complete,
    };
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Builds a human-readable outcome description based on the chain's title
 * and the final choice made.
 */
function buildOutcomeDescription(
  chain: NarrativeChain,
  progress: NarrativeChainProgress,
): string {
  const lastChoice = progress.choiceHistory[progress.choiceHistory.length - 1];
  if (!lastChoice) {
    return `Completed: ${chain.title}`;
  }

  // Find the choice label for a readable outcome
  for (const step of chain.steps) {
    if (step.id === lastChoice.stepId) {
      const choice = step.choices.find((c) => c.id === lastChoice.choiceId);
      if (choice) {
        return `${chain.title} — ${choice.label}`;
      }
    }
  }

  // Check species branches for the choice
  for (const overrides of Object.values(chain.speciesBranches)) {
    for (const override of overrides) {
      if (override.stepId === lastChoice.stepId && override.additionalChoices) {
        const choice = override.additionalChoices.find(
          (c) => c.id === lastChoice.choiceId,
        );
        if (choice) {
          return `${chain.title} — ${choice.label}`;
        }
      }
    }
  }

  return `Completed: ${chain.title}`;
}

/**
 * Aggregates all rewards granted throughout a chain's history into a single
 * summary reward object.
 */
function aggregateRewards(
  chain: NarrativeChain,
  progress: NarrativeChainProgress,
  speciesId: string,
): NarrativeReward {
  const total: NarrativeReward = {};

  for (const entry of progress.choiceHistory) {
    const step = resolveStep(chain, entry.stepId, speciesId);
    if (!step) continue;

    const choice = step.choices.find((c) => c.id === entry.choiceId);
    if (!choice?.rewards) continue;

    const r = choice.rewards;

    if (r.researchPoints) {
      total.researchPoints = (total.researchPoints ?? 0) + r.researchPoints;
    }
    if (r.minerals) {
      total.minerals = (total.minerals ?? 0) + r.minerals;
    }
    if (r.rareElements) {
      total.rareElements = (total.rareElements ?? 0) + r.rareElements;
    }
    if (r.exoticMaterials) {
      total.exoticMaterials = (total.exoticMaterials ?? 0) + r.exoticMaterials;
    }
    if (r.energy) {
      total.energy = (total.energy ?? 0) + r.energy;
    }
    if (r.credits) {
      total.credits = (total.credits ?? 0) + r.credits;
    }
    // Tech unlocks — keep the last one (most significant)
    if (r.techUnlock) {
      total.techUnlock = r.techUnlock;
    }
    // Lore fragment — keep the last one
    if (r.loreFragment) {
      total.loreFragment = r.loreFragment;
    }
    // Ship design unlock — keep any found
    if (r.shipDesignUnlock) {
      total.shipDesignUnlock = r.shipDesignUnlock;
    }
    // Wormhole route reveal — keep any found
    if (r.revealWormholeRoute) {
      total.revealWormholeRoute = r.revealWormholeRoute;
    }
  }

  return total;
}
