import { describe, it, expect } from 'vitest';
import {
  computeMaslowNeeds,
  lowestUnmetNeed,
  criticalNeedOverride,
  belongingDeprivationImpact,
} from '../../engine/psychology/maslow.js';
import type { EmpireStateSnapshot } from '../../engine/psychology/maslow.js';

function makeSnapshot(overrides: Partial<EmpireStateSnapshot> = {}): EmpireStateSnapshot {
  return {
    currentTick: 100,
    organics: 500,
    foodBalance: 10,
    energy: 200,
    minerals: 200,
    credits: 500,
    colonisedPlanets: 3,
    totalPopulation: 30000,
    militaryPower: 100,
    strongestRivalPower: 80,
    activeWars: 0,
    homeworldThreatened: false,
    activeTreaties: 2,
    allies: 1,
    tradeRoutes: 1,
    totalEmpires: 5,
    techsResearched: 10,
    totalTechs: 50,
    victoryProgress: 20,
    ...overrides,
  };
}

describe('computeMaslowNeeds', () => {
  it('should return high physiological when food is abundant', () => {
    const needs = computeMaslowNeeds(makeSnapshot());
    expect(needs.physiological).toBeGreaterThan(80);
  });

  it('should crash physiological when starving', () => {
    const needs = computeMaslowNeeds(makeSnapshot({
      foodBalance: -20,
      organics: 50,
    }));
    expect(needs.physiological).toBeLessThan(40);
  });

  it('should reduce safety when outgunned', () => {
    const needs = computeMaslowNeeds(makeSnapshot({
      militaryPower: 20,
      strongestRivalPower: 100,
    }));
    expect(needs.safety).toBeLessThan(70);
  });

  it('should reduce safety during active wars', () => {
    const peacetime = computeMaslowNeeds(makeSnapshot());
    const wartime = computeMaslowNeeds(makeSnapshot({ activeWars: 2 }));
    expect(wartime.safety).toBeLessThan(peacetime.safety);
  });

  it('should reduce safety when homeworld threatened', () => {
    const needs = computeMaslowNeeds(makeSnapshot({ homeworldThreatened: true }));
    const peacetime = computeMaslowNeeds(makeSnapshot());
    expect(needs.safety).toBeLessThan(peacetime.safety);
  });

  it('should have low belonging when isolated', () => {
    const needs = computeMaslowNeeds(makeSnapshot({
      activeTreaties: 0,
      allies: 0,
      tradeRoutes: 0,
    }));
    expect(needs.belonging).toBeLessThanOrEqual(15);
  });

  it('should have high belonging with allies and treaties', () => {
    const needs = computeMaslowNeeds(makeSnapshot({
      activeTreaties: 5,
      allies: 3,
      tradeRoutes: 3,
    }));
    expect(needs.belonging).toBeGreaterThan(70);
  });

  it('should increase esteem with technology', () => {
    const low = computeMaslowNeeds(makeSnapshot({ techsResearched: 2 }));
    const high = computeMaslowNeeds(makeSnapshot({ techsResearched: 40 }));
    expect(high.esteem).toBeGreaterThan(low.esteem);
  });

  it('should return values in 0-100 range for all needs', () => {
    const scenarios = [
      makeSnapshot(),
      makeSnapshot({ organics: 0, foodBalance: -50, energy: 0, minerals: 0, credits: 0 }),
      makeSnapshot({ activeTreaties: 10, allies: 5, tradeRoutes: 5, techsResearched: 50 }),
    ];
    for (const snap of scenarios) {
      const needs = computeMaslowNeeds(snap);
      for (const val of Object.values(needs)) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('lowestUnmetNeed', () => {
  it('should return the need with the lowest value', () => {
    expect(lowestUnmetNeed({
      physiological: 80,
      safety: 60,
      belonging: 20,
      esteem: 50,
      selfActualisation: 40,
    })).toBe('belonging');
  });

  it('should break ties by hierarchy order (physiological wins)', () => {
    expect(lowestUnmetNeed({
      physiological: 30,
      safety: 30,
      belonging: 30,
      esteem: 30,
      selfActualisation: 30,
    })).toBe('physiological');
  });
});

describe('criticalNeedOverride', () => {
  it('should return null when no needs are critical', () => {
    expect(criticalNeedOverride({
      physiological: 80,
      safety: 60,
      belonging: 40,
      esteem: 50,
      selfActualisation: 30,
    })).toBeNull();
  });

  it('should return physiological when food is critical', () => {
    expect(criticalNeedOverride({
      physiological: 15,
      safety: 60,
      belonging: 40,
      esteem: 50,
      selfActualisation: 30,
    })).toBe('physiological');
  });

  it('should return safety when militarily critical', () => {
    expect(criticalNeedOverride({
      physiological: 80,
      safety: 20,
      belonging: 40,
      esteem: 50,
      selfActualisation: 30,
    })).toBe('safety');
  });

  it('should return belonging when isolated and critical', () => {
    expect(criticalNeedOverride({
      physiological: 80,
      safety: 60,
      belonging: 10,
      esteem: 50,
      selfActualisation: 30,
    })).toBe('belonging');
  });

  it('should prioritise physiological over safety', () => {
    expect(criticalNeedOverride({
      physiological: 10,
      safety: 20,
      belonging: 10,
      esteem: 50,
      selfActualisation: 30,
    })).toBe('physiological');
  });
});

describe('belongingDeprivationImpact', () => {
  it('should return 0 when belonging is sufficient', () => {
    expect(belongingDeprivationImpact(70, 'anxious')).toBe(0);
  });

  it('should return highest impact for anxious attachment', () => {
    const anxious = belongingDeprivationImpact(20, 'anxious');
    const secure = belongingDeprivationImpact(20, 'secure');
    const avoidant = belongingDeprivationImpact(20, 'avoidant');
    expect(anxious).toBeGreaterThan(secure);
    expect(secure).toBeGreaterThan(avoidant);
  });

  it('should scale with deficit severity', () => {
    const mild = belongingDeprivationImpact(40, 'anxious');
    const severe = belongingDeprivationImpact(10, 'anxious');
    expect(severe).toBeGreaterThan(mild);
  });
});
