import type { Demand, DemandState } from '../types/diplomacy.js';

/** Default demand deadline: 10 ticks from creation. */
export const DEMAND_DEADLINE_TICKS = 10;

export function initDemandState(): DemandState {
  return { demands: [] };
}

export function createDemand(state: DemandState, demand: Demand): DemandState {
  return { demands: [...state.demands, demand] };
}

export function acceptDemand(
  state: DemandState, demandId: string,
): { state: DemandState; demand: Demand | null } {
  const idx = state.demands.findIndex(d => d.id === demandId && d.status === 'pending');
  if (idx === -1) return { state, demand: null };
  const updated = { ...state.demands[idx], status: 'accepted' as const };
  const demands = [...state.demands];
  demands[idx] = updated;
  return { state: { demands }, demand: updated };
}

export function rejectDemand(
  state: DemandState, demandId: string,
): { state: DemandState; demand: Demand | null } {
  const idx = state.demands.findIndex(d => d.id === demandId && d.status === 'pending');
  if (idx === -1) return { state, demand: null };
  const updated = { ...state.demands[idx], status: 'rejected' as const };
  const demands = [...state.demands];
  demands[idx] = updated;
  return { state: { demands }, demand: updated };
}

export function processDemandsTick(
  state: DemandState, currentTick: number,
): { state: DemandState; expired: Demand[] } {
  const expired: Demand[] = [];
  const demands = state.demands.map(d => {
    if (d.status === 'pending' && currentTick >= d.deadline) {
      const exp = { ...d, status: 'expired' as const };
      expired.push(exp);
      return exp;
    }
    return d;
  });
  return { state: { demands }, expired };
}

/**
 * AI evaluation: should this empire accept the demand?
 * Uses psychology dimensions from the relationship with the demander.
 *
 * High fear + war threat → comply (survival instinct)
 * High respect + low fear → defiant rejection
 * Friendly warmth → more likely to comply (goodwill)
 *
 * Returns { accept: boolean, probability: number (0-1) }
 */
export function evaluateDemandAI(
  demand: Demand,
  fear: number,      // 0-100
  warmth: number,    // -100 to 100
  trust: number,     // 0-100
  respect: number,   // -100 to 100
): { accept: boolean; probability: number } {
  // Base reluctance: nobody wants to give stuff away
  let score = -30;

  // Fear is the primary lever for demands
  score += fear * 0.5; // 0-50 points from fear

  // War threat is scarier than sanctions or reputation
  const threatMultiplier = demand.threat === 'war' ? 1.5 : demand.threat === 'sanctions' ? 1.0 : 0.5;
  score *= threatMultiplier > 1 ? threatMultiplier : 1;
  // Add threat bonus separately for non-war
  if (demand.threat !== 'war') score += (threatMultiplier - 1) * 10;

  // Warmth: friendly empires are more generous
  score += warmth * 0.15; // -15 to +15

  // Trust: trusted demanders get benefit of the doubt
  score += (trust - 50) * 0.1; // -5 to +5

  // Respect: high respect for target = defiance (they think they're strong)
  // Negative respect for demander = extra defiance
  score -= Math.max(0, respect) * 0.1; // 0 to -10

  // Normalise to 0-1 probability via sigmoid
  const probability = 1 / (1 + Math.exp(-score / 15));

  return {
    accept: probability > 0.5,
    probability: Math.round(probability * 100) / 100,
  };
}
