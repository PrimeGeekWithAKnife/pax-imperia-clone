import { describe, it, expect } from 'vitest';
import type { Demand } from '../types/diplomacy.js';
import {
  initDemandState,
  createDemand,
  acceptDemand,
  rejectDemand,
  processDemandsTick,
  evaluateDemandAI,
  DEMAND_DEADLINE_TICKS,
} from '../engine/demands.js';

function makeDemand(overrides: Partial<Demand> = {}): Demand {
  return {
    id: 'demand-1',
    proposerId: 'empire-a',
    targetId: 'empire-b',
    createdTick: 10,
    deadline: 10 + DEMAND_DEADLINE_TICKS,
    status: 'pending',
    demandType: 'resources',
    threat: 'war',
    resourceType: 'credits',
    amount: 500,
    description: 'Hand over 500 credits or face war.',
    ...overrides,
  };
}

describe('demands engine', () => {
  describe('initDemandState', () => {
    it('returns empty demands array', () => {
      const state = initDemandState();
      expect(state).toEqual({ demands: [] });
    });
  });

  describe('createDemand', () => {
    it('adds demand to state and preserves existing', () => {
      const existing = makeDemand({ id: 'demand-0' });
      const state = { demands: [existing] };
      const newDemand = makeDemand({ id: 'demand-1' });

      const result = createDemand(state, newDemand);

      expect(result.demands).toHaveLength(2);
      expect(result.demands[0]).toEqual(existing);
      expect(result.demands[1]).toEqual(newDemand);
      // Immutability check
      expect(state.demands).toHaveLength(1);
    });
  });

  describe('acceptDemand', () => {
    it('finds demand by ID and sets status to accepted', () => {
      const demand = makeDemand();
      const state = { demands: [demand] };

      const { state: newState, demand: accepted } = acceptDemand(state, 'demand-1');

      expect(accepted).not.toBeNull();
      expect(accepted!.status).toBe('accepted');
      expect(newState.demands[0].status).toBe('accepted');
      // Immutability check
      expect(state.demands[0].status).toBe('pending');
    });

    it('returns null if demand not found', () => {
      const state = { demands: [makeDemand()] };

      const { state: newState, demand: result } = acceptDemand(state, 'nonexistent');

      expect(result).toBeNull();
      expect(newState).toBe(state);
    });
  });

  describe('rejectDemand', () => {
    it('finds demand by ID and sets status to rejected', () => {
      const demand = makeDemand();
      const state = { demands: [demand] };

      const { state: newState, demand: rejected } = rejectDemand(state, 'demand-1');

      expect(rejected).not.toBeNull();
      expect(rejected!.status).toBe('rejected');
      expect(newState.demands[0].status).toBe('rejected');
      // Immutability check
      expect(state.demands[0].status).toBe('pending');
    });
  });

  describe('processDemandsTick', () => {
    it('expires demands past deadline', () => {
      const demand = makeDemand({ deadline: 15 });
      const state = { demands: [demand] };

      const { state: newState, expired } = processDemandsTick(state, 15);

      expect(expired).toHaveLength(1);
      expect(expired[0].status).toBe('expired');
      expect(newState.demands[0].status).toBe('expired');
    });

    it('does not expire pending demands before deadline', () => {
      const demand = makeDemand({ deadline: 20 });
      const state = { demands: [demand] };

      const { state: newState, expired } = processDemandsTick(state, 15);

      expect(expired).toHaveLength(0);
      expect(newState.demands[0].status).toBe('pending');
    });
  });

  describe('evaluateDemandAI', () => {
    it('high fear + war threat → likely accept', () => {
      const demand = makeDemand({ threat: 'war' });
      const result = evaluateDemandAI(demand, 90, 0, 50, 0);

      expect(result.accept).toBe(true);
      expect(result.probability).toBeGreaterThan(0.6);
    });

    it('low fear + high respect → likely reject', () => {
      const demand = makeDemand({ threat: 'sanctions' });
      const result = evaluateDemandAI(demand, 10, 0, 50, 80);

      expect(result.accept).toBe(false);
      expect(result.probability).toBeLessThan(0.4);
    });

    it('friendly warmth → more likely to comply', () => {
      const demand = makeDemand({ threat: 'reputation' });
      const coldResult = evaluateDemandAI(demand, 50, -50, 50, 0);
      const warmResult = evaluateDemandAI(demand, 50, 80, 50, 0);

      expect(warmResult.probability).toBeGreaterThan(coldResult.probability);
    });
  });
});
