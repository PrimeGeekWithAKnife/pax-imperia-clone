import { describe, it, expect } from 'vitest';
import {
  initialiseMarketState,
  processMarketTick,
  applySanctions,
  manipulateMarket,
  calculateInflation,
  DEFAULT_COMMODITIES,
} from '../engine/marketplace.js';
import type {
  MarketState,
  MarketEmpireView,
  MarketTradeRouteView,
} from '../engine/marketplace.js';

// ---------------------------------------------------------------------------
// Deterministic RNG
// ---------------------------------------------------------------------------

function makeRng(initialSeed = 42) {
  let seed = initialSeed;
  return () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return seed / 2147483647;
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEmpireView(id: string, overrides: Partial<MarketEmpireView> = {}): MarketEmpireView {
  return {
    id,
    credits: 500,
    totalPopulation: 50_000,
    tradeHubCount: 2,
    factoryCount: 3,
    miningFacilityCount: 4,
    researchLabCount: 2,
    shipyardCount: 1,
    isBlockaded: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Commodity marketplace engine', () => {

  // ── initialiseMarketState ────────────────────────────────────────────────

  describe('initialiseMarketState', () => {
    it('creates local markets for each empire', () => {
      const state = initialiseMarketState(['emp_a', 'emp_b', 'emp_c']);

      expect(state.localMarkets.size).toBe(3);
      expect(state.localMarkets.has('emp_a')).toBe(true);
      expect(state.localMarkets.has('emp_b')).toBe(true);
      expect(state.localMarkets.has('emp_c')).toBe(true);
    });

    it('populates each local market with the full commodity catalogue', () => {
      const state = initialiseMarketState(['emp_a']);
      const market = state.localMarkets.get('emp_a')!;

      expect(market.listings.length).toBe(DEFAULT_COMMODITIES.length);

      // Every commodity should be present
      for (const def of DEFAULT_COMMODITIES) {
        const listing = market.listings.find((l) => l.commodityId === def.id);
        expect(listing).toBeDefined();
        expect(listing!.currentPrice).toBe(def.basePrice);
        expect(listing!.basePrice).toBe(def.basePrice);
      }
    });

    it('starts the galactic market as closed with no members', () => {
      const state = initialiseMarketState(['emp_a', 'emp_b']);
      expect(state.galacticMarket.open).toBe(false);
      expect(state.galacticMarket.memberEmpires.length).toBe(0);
    });

    it('sets supply and demand at equilibrium for new listings', () => {
      const state = initialiseMarketState(['emp_a']);
      const market = state.localMarkets.get('emp_a')!;

      for (const listing of market.listings) {
        expect(listing.supply).toBe(100);
        expect(listing.demand).toBe(100);
        expect(listing.trend).toBe('stable');
      }
    });
  });

  // ── processMarketTick ────────────────────────────────────────────────────

  describe('processMarketTick', () => {
    it('adjusts prices based on supply and demand imbalance', () => {
      const state = initialiseMarketState(['emp_a']);
      const rng = makeRng();

      // Create an empire with high demand (many factories) but low supply (few mines)
      const empires = [makeEmpireView('emp_a', {
        factoryCount: 20,
        miningFacilityCount: 1,
        totalPopulation: 200_000,
      })];

      // Run several ticks to let prices adjust
      let current = state;
      for (let tick = 1; tick <= 15; tick++) {
        const result = processMarketTick(current, empires, [], tick, rng);
        current = result.state;
      }

      // With high demand and low supply, prices should have risen from base
      const market = current.localMarkets.get('emp_a')!;
      const rawOre = market.listings.find((l) => l.commodityId === 'raw_ore')!;
      expect(rawOre.currentPrice).toBeGreaterThan(rawOre.basePrice);
    });

    it('lowers prices when supply exceeds demand', () => {
      const state = initialiseMarketState(['emp_a']);
      const rng = makeRng(99);

      // Create an empire with high supply (many mines) but low demand
      const empires = [makeEmpireView('emp_a', {
        factoryCount: 0,
        miningFacilityCount: 30,
        shipyardCount: 0,
        researchLabCount: 0,
        totalPopulation: 1_000,
      })];

      let current = state;
      for (let tick = 1; tick <= 15; tick++) {
        const result = processMarketTick(current, empires, [], tick, rng);
        current = result.state;
      }

      // With oversupply, at least some prices should have dropped
      const market = current.localMarkets.get('emp_a')!;
      const someDropped = market.listings.some(
        (l) => l.currentPrice < l.basePrice,
      );
      expect(someDropped).toBe(true);
    });

    it('emits price_shift events for significant price movements', () => {
      const state = initialiseMarketState(['emp_a']);
      const rng = makeRng();

      const empires = [makeEmpireView('emp_a', {
        factoryCount: 30,
        miningFacilityCount: 1,
        totalPopulation: 500_000,
      })];

      let allEvents: Array<{ type: string }> = [];
      let current = state;
      for (let tick = 1; tick <= 20; tick++) {
        const result = processMarketTick(current, empires, [], tick, rng);
        current = result.state;
        allEvents.push(...result.events);
      }

      const priceShifts = allEvents.filter((e) => e.type === 'price_shift');
      expect(priceShifts.length).toBeGreaterThan(0);
    });
  });

  // ── applySanctions ───────────────────────────────────────────────────────

  describe('applySanctions', () => {
    it('reduces market access by adding sanctioning empires', () => {
      const state = initialiseMarketState(['emp_a', 'emp_b', 'emp_c']);

      const result = applySanctions(state, 'emp_a', ['emp_b', 'emp_c'], 1);

      const sanctionedMarket = result.state.localMarkets.get('emp_a')!;
      expect(sanctionedMarket.sanctionedBy).toContain('emp_b');
      expect(sanctionedMarket.sanctionedBy).toContain('emp_c');
    });

    it('blocks rare and ultra-rare commodities proportional to sanctions', () => {
      const state = initialiseMarketState(['emp_a', 'emp_b', 'emp_c']);

      // One sanctioner
      const result1 = applySanctions(state, 'emp_a', ['emp_b'], 1);
      const blocked1 = result1.state.localMarkets.get('emp_a')!.blockedCommodities.size;

      // Two sanctioners — should block more
      const result2 = applySanctions(state, 'emp_a', ['emp_b', 'emp_c'], 1);
      const blocked2 = result2.state.localMarkets.get('emp_a')!.blockedCommodities.size;

      expect(blocked2).toBeGreaterThan(blocked1);
    });

    it('emits a sanction_applied event', () => {
      const state = initialiseMarketState(['emp_a', 'emp_b']);

      const result = applySanctions(state, 'emp_a', ['emp_b'], 5);

      const sanctionEvent = result.events.find((e) => e.type === 'sanction_applied');
      expect(sanctionEvent).toBeDefined();
    });
  });

  // ── manipulateMarket ─────────────────────────────────────────────────────

  describe('manipulateMarket', () => {
    it('flooding increases supply and has negative price impact', () => {
      const state = initialiseMarketState(['emp_a']);
      const rng = makeRng();
      const originalSupply = state.localMarkets.get('emp_a')!
        .listings.find((l) => l.commodityId === 'raw_ore')!.supply;

      const result = manipulateMarket(state, 'emp_a', 'raw_ore', 'flood', 200, 1, rng);

      const newSupply = result.state.localMarkets.get('emp_a')!
        .listings.find((l) => l.commodityId === 'raw_ore')!.supply;
      expect(newSupply).toBeGreaterThan(originalSupply);

      // Manipulation event should show negative price impact
      const event = result.events.find((e) => e.type === 'manipulation');
      expect(event).toBeDefined();
      if (event && event.type === 'manipulation') {
        expect(event.priceImpact).toBeLessThan(0);
      }
    });

    it('hoarding reduces supply and has positive price impact', () => {
      const state = initialiseMarketState(['emp_a']);
      const rng = makeRng();
      const originalSupply = state.localMarkets.get('emp_a')!
        .listings.find((l) => l.commodityId === 'raw_ore')!.supply;

      const result = manipulateMarket(state, 'emp_a', 'raw_ore', 'hoard', 50, 1, rng);

      const newSupply = result.state.localMarkets.get('emp_a')!
        .listings.find((l) => l.commodityId === 'raw_ore')!.supply;
      expect(newSupply).toBeLessThan(originalSupply);

      const event = result.events.find((e) => e.type === 'manipulation');
      expect(event).toBeDefined();
      if (event && event.type === 'manipulation') {
        expect(event.priceImpact).toBeGreaterThan(0);
      }
    });
  });

  // ── calculateInflation ───────────────────────────────────────────────────

  describe('calculateInflation', () => {
    it('returns 1.0 for a balanced economy with no sanctions', () => {
      const state = initialiseMarketState(['emp_a']);
      const empire = makeEmpireView('emp_a');

      const inflation = calculateInflation(empire, state);

      // Should be close to neutral
      expect(inflation).toBeGreaterThanOrEqual(0.9);
      expect(inflation).toBeLessThanOrEqual(1.1);
    });

    it('returns a value within the valid range (0.9 to 1.3)', () => {
      const state = initialiseMarketState(['emp_a']);

      // Extreme negative conditions
      const empire = makeEmpireView('emp_a', {
        credits: -5000,
        isBlockaded: true,
        tradeHubCount: 10,
      });

      // Add sanctions
      const sanctioned = applySanctions(state, 'emp_a', ['b', 'c', 'd', 'e'], 1);
      const inflation = calculateInflation(empire, sanctioned.state);

      expect(inflation).toBeGreaterThanOrEqual(0.9);
      expect(inflation).toBeLessThanOrEqual(1.3);
    });

    it('increases with deficit spending', () => {
      const state = initialiseMarketState(['emp_a']);

      const healthy = makeEmpireView('emp_a', { credits: 1000 });
      const deficit = makeEmpireView('emp_a', { credits: -800 });

      const healthyInflation = calculateInflation(healthy, state);
      const deficitInflation = calculateInflation(deficit, state);

      expect(deficitInflation).toBeGreaterThan(healthyInflation);
    });

    it('increases when sanctioned', () => {
      const baseState = initialiseMarketState(['emp_a', 'emp_b', 'emp_c']);
      const empire = makeEmpireView('emp_a');

      const unsanctionedInflation = calculateInflation(empire, baseState);

      const sanctioned = applySanctions(baseState, 'emp_a', ['emp_b', 'emp_c'], 1);
      const sanctionedInflation = calculateInflation(empire, sanctioned.state);

      expect(sanctionedInflation).toBeGreaterThan(unsanctionedInflation);
    });
  });
});
