import { describe, it, expect } from 'vitest';
import {
  initReputationState,
  recordReputationEvent,
  processReputationTick,
  getReputationModifier,
} from '../engine/reputation.js';
import type { ReputationEvent } from '../types/reputation.js';

describe('Reputation Engine', () => {
  // -------------------------------------------------------------------------
  // initReputationState
  // -------------------------------------------------------------------------

  it('initReputationState — creates state with correct empire scores at 0', () => {
    const state = initReputationState(['empire-a', 'empire-b', 'empire-c']);
    expect(state.scores).toEqual({
      'empire-a': 0,
      'empire-b': 0,
      'empire-c': 0,
    });
    expect(state.events).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // recordReputationEvent
  // -------------------------------------------------------------------------

  it('recordReputationEvent — adjusts score and adds to events log', () => {
    const state = initReputationState(['empire-a']);
    const event: ReputationEvent = {
      tick: 1,
      empireId: 'empire-a',
      type: 'aid_provided',
      value: 5,
      description: 'Sent humanitarian aid to a neutral colony',
    };
    const next = recordReputationEvent(state, event);
    expect(next.scores['empire-a']).toBe(5);
    expect(next.events).toHaveLength(1);
    expect(next.events[0]).toEqual(event);
    // Original state must be unchanged (immutability).
    expect(state.scores['empire-a']).toBe(0);
    expect(state.events).toHaveLength(0);
  });

  it('recordReputationEvent — clamps score to -100..+100', () => {
    let state = initReputationState(['empire-a']);

    // Push well above +100.
    for (let i = 0; i < 25; i++) {
      state = recordReputationEvent(state, {
        tick: i,
        empireId: 'empire-a',
        type: 'defended_ally',
        value: 10,
        description: 'Defended an ally',
      });
    }
    expect(state.scores['empire-a']).toBe(100);

    // Now push well below -100.
    state = initReputationState(['empire-a']);
    for (let i = 0; i < 10; i++) {
      state = recordReputationEvent(state, {
        tick: i,
        empireId: 'empire-a',
        type: 'betrayal',
        value: -25,
        description: 'Betrayed an ally',
      });
    }
    expect(state.scores['empire-a']).toBe(-100);
  });

  it('recordReputationEvent — caps events log at 100 entries', () => {
    let state = initReputationState(['empire-a']);
    for (let i = 0; i < 110; i++) {
      state = recordReputationEvent(state, {
        tick: i,
        empireId: 'empire-a',
        type: 'treaty_honoured',
        value: 2,
        description: `Honoured treaty #${i}`,
      });
    }
    expect(state.events).toHaveLength(100);
    // Oldest events should have been dropped — first remaining should be tick 10.
    expect(state.events[0].tick).toBe(10);
    expect(state.events[99].tick).toBe(109);
  });

  // -------------------------------------------------------------------------
  // processReputationTick
  // -------------------------------------------------------------------------

  it('processReputationTick — decays scores toward 0', () => {
    let state = initReputationState(['empire-a', 'empire-b']);
    state = recordReputationEvent(state, {
      tick: 0,
      empireId: 'empire-a',
      type: 'aid_provided',
      value: 50,
      description: 'Aid',
    });
    state = recordReputationEvent(state, {
      tick: 0,
      empireId: 'empire-b',
      type: 'betrayal',
      value: -25,
      description: 'Betrayal',
    });

    const next = processReputationTick(state, 1);
    // Positive score should decrease slightly.
    expect(next.scores['empire-a']).toBeLessThan(50);
    expect(next.scores['empire-a']).toBeCloseTo(50 * 0.997, 5);
    // Negative score should increase toward 0.
    expect(next.scores['empire-b']).toBeGreaterThan(-25);
    expect(next.scores['empire-b']).toBeCloseTo(-25 * 0.997, 5);
  });

  it('processReputationTick — snaps near-zero scores to 0', () => {
    let state = initReputationState(['empire-a']);
    state = recordReputationEvent(state, {
      tick: 0,
      empireId: 'empire-a',
      type: 'treaty_honoured',
      value: 0.3,
      description: 'Minor honour',
    });
    expect(state.scores['empire-a']).toBe(0.3);

    const next = processReputationTick(state, 1);
    // 0.3 * 0.997 = 0.2991, which is < 0.5, so should snap to 0.
    expect(next.scores['empire-a']).toBe(0);
  });

  // -------------------------------------------------------------------------
  // getReputationModifier
  // -------------------------------------------------------------------------

  it('getReputationModifier — returns correct modifiers for positive score', () => {
    const mods = getReputationModifier(100);
    expect(mods.treatyAcceptanceBonus).toBeCloseTo(20, 5);
    expect(mods.tradeMultiplier).toBeCloseTo(1.2, 5);
    expect(mods.firstContactBonus).toBe(15);
  });

  it('getReputationModifier — returns correct modifiers for negative score', () => {
    const mods = getReputationModifier(-100);
    expect(mods.treatyAcceptanceBonus).toBeCloseTo(-20, 5);
    expect(mods.tradeMultiplier).toBeCloseTo(0.8, 5);
    expect(mods.firstContactBonus).toBe(-15);
  });

  it('getReputationModifier — returns neutral modifiers for 0', () => {
    const mods = getReputationModifier(0);
    expect(mods.treatyAcceptanceBonus).toBe(0);
    expect(mods.tradeMultiplier).toBe(1);
    expect(mods.firstContactBonus).toBe(0);
  });
});
