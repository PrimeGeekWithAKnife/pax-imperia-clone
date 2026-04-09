import type { EmbargoState } from '../types/diplomacy.js';

export function initEmbargoState(): EmbargoState {
  return { embargoes: [] };
}

export function declareEmbargo(
  state: EmbargoState,
  initiatorId: string,
  targetId: string,
  tick: number,
  reason: string,
): EmbargoState {
  // Prevent duplicate embargoes for the same initiator+target pair
  if (state.embargoes.some(e => e.initiatorId === initiatorId && e.targetId === targetId)) {
    return state;
  }
  return {
    embargoes: [...state.embargoes, { initiatorId, targetId, startTick: tick, reason }],
  };
}

export function liftEmbargo(
  state: EmbargoState,
  initiatorId: string,
  targetId: string,
): EmbargoState {
  return {
    embargoes: state.embargoes.filter(
      e => !(e.initiatorId === initiatorId && e.targetId === targetId),
    ),
  };
}

export function isEmbargoed(
  state: EmbargoState,
  empireA: string,
  empireB: string,
): boolean {
  return state.embargoes.some(
    e =>
      (e.initiatorId === empireA && e.targetId === empireB) ||
      (e.initiatorId === empireB && e.targetId === empireA),
  );
}

export function getEmbargoedPartners(
  state: EmbargoState,
  empireId: string,
): string[] {
  return state.embargoes
    .filter(e => e.initiatorId === empireId || e.targetId === empireId)
    .map(e => (e.initiatorId === empireId ? e.targetId : e.initiatorId));
}
