import { describe, it, expect } from 'vitest';
import {
  initEmbargoState,
  declareEmbargo,
  liftEmbargo,
  isEmbargoed,
  getEmbargoedPartners,
} from '../engine/embargo.js';

describe('embargo engine', () => {
  it('initEmbargoState returns empty embargoes array', () => {
    const state = initEmbargoState();
    expect(state.embargoes).toEqual([]);
  });

  it('declareEmbargo adds an embargo', () => {
    const state = initEmbargoState();
    const next = declareEmbargo(state, 'empire-a', 'empire-b', 10, 'trade dispute');
    expect(next.embargoes).toHaveLength(1);
    expect(next.embargoes[0]).toEqual({
      initiatorId: 'empire-a',
      targetId: 'empire-b',
      startTick: 10,
      reason: 'trade dispute',
    });
  });

  it('declareEmbargo prevents duplicates for same initiator+target', () => {
    let state = initEmbargoState();
    state = declareEmbargo(state, 'empire-a', 'empire-b', 10, 'first');
    const next = declareEmbargo(state, 'empire-a', 'empire-b', 20, 'second');
    expect(next.embargoes).toHaveLength(1);
    expect(next.embargoes[0].reason).toBe('first');
  });

  it('liftEmbargo removes the embargo', () => {
    let state = initEmbargoState();
    state = declareEmbargo(state, 'empire-a', 'empire-b', 10, 'reason');
    const next = liftEmbargo(state, 'empire-a', 'empire-b');
    expect(next.embargoes).toHaveLength(0);
  });

  it('liftEmbargo is a no-op if embargo does not exist', () => {
    const state = initEmbargoState();
    const next = liftEmbargo(state, 'empire-a', 'empire-b');
    expect(next.embargoes).toHaveLength(0);
  });

  it('isEmbargoed returns true when embargo exists A->B or B->A', () => {
    let state = initEmbargoState();
    state = declareEmbargo(state, 'empire-a', 'empire-b', 10, 'reason');
    expect(isEmbargoed(state, 'empire-a', 'empire-b')).toBe(true);
    expect(isEmbargoed(state, 'empire-b', 'empire-a')).toBe(true);
  });

  it('isEmbargoed returns false when no embargo exists', () => {
    const state = initEmbargoState();
    expect(isEmbargoed(state, 'empire-a', 'empire-b')).toBe(false);
  });

  it('getEmbargoedPartners returns all targets for an empire', () => {
    let state = initEmbargoState();
    state = declareEmbargo(state, 'empire-a', 'empire-b', 10, 'reason-1');
    state = declareEmbargo(state, 'empire-c', 'empire-a', 20, 'reason-2');
    const partners = getEmbargoedPartners(state, 'empire-a');
    expect(partners).toHaveLength(2);
    expect(partners).toContain('empire-b');
    expect(partners).toContain('empire-c');
  });
});
