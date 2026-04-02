import { describe, it, expect } from 'vitest';
import {
  NEUTRAL_MOOD,
  applyMoodEvent,
  decayMood,
  processMoodTick,
} from '../../engine/psychology/mood.js';
import type { MoodEvent } from '../../engine/psychology/mood.js';
import type { MoodState, AttachmentStyle } from '../../types/psychology.js';

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

describe('NEUTRAL_MOOD', () => {
  it('should have baseline values', () => {
    expect(NEUTRAL_MOOD.valence).toBe(0);
    expect(NEUTRAL_MOOD.arousal).toBe(20);
    expect(NEUTRAL_MOOD.dominance).toBe(50);
    expect(NEUTRAL_MOOD.anxiety).toBe(20);
    expect(NEUTRAL_MOOD.anger).toBe(0);
  });
});

describe('applyMoodEvent', () => {
  it('should apply positive valence for secure attachment', () => {
    const event: MoodEvent = { valence: 20 };
    const result = applyMoodEvent({ ...NEUTRAL_MOOD }, event, 'secure');
    expect(result.valence).toBe(20); // 1.0 multiplier
  });

  it('should amplify events for anxious attachment', () => {
    const event: MoodEvent = { valence: 20 };
    const result = applyMoodEvent({ ...NEUTRAL_MOOD }, event, 'anxious');
    expect(result.valence).toBe(40); // 2.0 multiplier
  });

  it('should dampen events for avoidant attachment', () => {
    const event: MoodEvent = { valence: 20 };
    const result = applyMoodEvent({ ...NEUTRAL_MOOD }, event, 'avoidant');
    expect(result.valence).toBe(8); // 0.4 multiplier
  });

  it('should ignore events below trigger threshold', () => {
    const event: MoodEvent = { valence: 3 };
    const result = applyMoodEvent({ ...NEUTRAL_MOOD }, event, 'secure');
    // Trigger threshold for secure is 5 — event of 3 should be ignored
    expect(result.valence).toBe(NEUTRAL_MOOD.valence);
  });

  it('should clamp values to valid ranges', () => {
    const mood: MoodState = { valence: 90, arousal: 90, dominance: 90, anxiety: 90, anger: 90 };
    const event: MoodEvent = { valence: 50, arousal: 50, anxiety: 50, anger: 50 };
    const result = applyMoodEvent(mood, event, 'anxious');
    expect(result.valence).toBe(100);
    expect(result.arousal).toBe(100);
    expect(result.anxiety).toBe(100);
    expect(result.anger).toBe(100);
  });

  it('should handle negative valence', () => {
    const event: MoodEvent = { valence: -30, anger: 20 };
    const result = applyMoodEvent({ ...NEUTRAL_MOOD }, event, 'secure');
    expect(result.valence).toBe(-30);
    expect(result.anger).toBe(20);
  });
});

describe('decayMood', () => {
  it('should decay valence toward 0', () => {
    const mood: MoodState = { valence: 50, arousal: 20, dominance: 50, anxiety: 20, anger: 0 };
    const decayed = decayMood(mood, 'secure', 'baseline');
    expect(decayed.valence).toBeLessThan(50);
    expect(decayed.valence).toBeGreaterThan(0);
  });

  it('should decay faster for secure than avoidant', () => {
    const mood: MoodState = { valence: 50, arousal: 50, dominance: 50, anxiety: 50, anger: 50 };
    const secureDecayed = decayMood(mood, 'secure', 'baseline');
    const avoidantDecayed = decayMood(mood, 'avoidant', 'baseline');

    // Secure should be closer to neutral after one tick
    const secureDist = Math.abs(secureDecayed.valence - NEUTRAL_MOOD.valence);
    const avoidantDist = Math.abs(avoidantDecayed.valence - NEUTRAL_MOOD.valence);
    expect(secureDist).toBeLessThan(avoidantDist);
  });

  it('should add jitter for fearful-avoidant', () => {
    const mood: MoodState = { ...NEUTRAL_MOOD };
    const rng = seededRng(42);
    // Run many ticks to see if values deviate from baseline
    let current = mood;
    let deviated = false;
    for (let i = 0; i < 20; i++) {
      current = decayMood(current, 'fearful_avoidant', 'baseline', rng);
      if (current.valence !== NEUTRAL_MOOD.valence) deviated = true;
    }
    expect(deviated).toBe(true);
  });

  it('should slow decay under high stress', () => {
    const mood: MoodState = { valence: -50, arousal: 80, dominance: 30, anxiety: 80, anger: 60 };
    const baselineDecay = decayMood(mood, 'secure', 'baseline');
    const stressDecay = decayMood(mood, 'secure', 'extreme');

    // Under extreme stress, anxiety should decay less (stay higher)
    expect(Math.abs(stressDecay.anxiety - mood.anxiety)).toBeLessThan(
      Math.abs(baselineDecay.anxiety - mood.anxiety),
    );
  });
});

describe('processMoodTick', () => {
  it('should apply events and then decay', () => {
    const events: MoodEvent[] = [
      { valence: -20, anger: 15 },
      { valence: 5 },
    ];
    const result = processMoodTick({ ...NEUTRAL_MOOD }, events, 'secure');
    // Net: valence = 0 + (-20) + 5 = -15 before decay
    // After decay, valence should be between -15 and 0
    expect(result.valence).toBeLessThan(0);
    expect(result.anger).toBeGreaterThan(0);
  });

  it('should handle empty events', () => {
    const result = processMoodTick({ ...NEUTRAL_MOOD }, [], 'secure');
    // Should still be near neutral after decay (already at baseline)
    expect(result.valence).toBe(NEUTRAL_MOOD.valence);
  });
});
