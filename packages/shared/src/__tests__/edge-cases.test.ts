/**
 * Comprehensive edge-case tests covering government types, species validation,
 * food balance, starting conditions, tech tree integrity, trade routes,
 * first contact, AI personality, demographics, and galaxy generation.
 *
 * Written as part of the QA + Security audit.
 */

import { describe, it, expect } from 'vitest';

// ── Data imports ──────────────────────────────────────────────────────────────
import { PREBUILT_SPECIES, PREBUILT_SPECIES_BY_ID } from '../../data/species/index.js';
import {
  UNIVERSAL_TECH_TREE,
  UNIVERSAL_TECHNOLOGIES,
  UNIVERSAL_TECH_BY_ID,
} from '../../data/tech/index.js';

// ── Type imports ──────────────────────────────────────────────────────────────
import type { GovernmentType } from '../types/government.js';
import type { AIPersonalityProfile } from '../types/ai-personality.js';
import type { Species } from '../types/species.js';
import type { TradeRoute, TradeRouteStatus } from '../types/trade-routes.js';
import type { FirstContactApproach, FirstContactReaction } from '../types/first-contact.js';
import type { GalaxyGenerationConfig } from '../generation/galaxy-generator.js';

// ── Engine imports ────────────────────────────────────────────────────────────
import { GOVERNMENTS } from '../types/government.js';
import { SpeciesSchema, totalTraitPoints } from '../validation/species.js';
import { BUILDING_DEFINITIONS } from '../constants/buildings.js';
import {
  calculateOrganicsConsumption,
  ORGANICS_PER_POPULATION,
} from '../engine/economy.js';
import {
  initializeGame,
  createStartingFleet,
  type GameSetupConfig,
  type PlayerSetup,
} from '../engine/game-init.js';
import {
  establishTradeRoute,
  tickTradeRoutes,
  rerouteTradeRoute,
  calculateTradeRevenue,
} from '../engine/trade-routes.js';
import {
  resolveFirstContact,
  resolveFirstContactOutcome,
} from '../engine/first-contact.js';
import {
  calculateBehaviourWeights,
  SPECIES_DEFAULT_PROFILES,
} from '../engine/ai/personality.js';
import {
  createInitialDemographics,
  tickDemographics,
  type DemographicModifiers,
} from '../engine/demographics.js';
import { generateGalaxy } from '../generation/galaxy-generator.js';
import { GALAXY_SIZES } from '../constants/game.js';

// ══════════════════════════════════════════════════════════════════════════════
// 1. GOVERNMENT TYPES — all 14 must have valid modifiers
// ══════════════════════════════════════════════════════════════════════════════

describe('Government types — modifier validation', () => {
  const allGovernmentTypes = Object.keys(GOVERNMENTS) as GovernmentType[];

  it('should have exactly 14 government types', () => {
    expect(allGovernmentTypes).toHaveLength(14);
  });

  // Multiplier keys — these must never be zero (would break economy/combat).
  const MULTIPLIER_KEYS: Array<keyof import('../types/government.js').GovernmentModifiers> = [
    'constructionSpeed',
    'researchSpeed',
    'tradeIncome',
    'populationGrowth',
    'combatBonus',
    'buildingCost',
    'decisionSpeed',
  ];

  // All modifier keys including happiness (which CAN be zero).
  const ALL_MODIFIER_KEYS: Array<keyof import('../types/government.js').GovernmentModifiers> = [
    ...MULTIPLIER_KEYS,
    'happiness',
  ];

  for (const govType of Object.keys(GOVERNMENTS) as GovernmentType[]) {
    describe(`government "${govType}"`, () => {
      const gov = GOVERNMENTS[govType];

      it('has a non-empty name', () => {
        expect(gov.name.length).toBeGreaterThan(0);
      });

      it('has a non-empty description', () => {
        expect(gov.description.length).toBeGreaterThan(0);
      });

      for (const key of ALL_MODIFIER_KEYS) {
        it(`modifier "${key}" is a finite number (not NaN, not Infinity)`, () => {
          const value = gov.modifiers[key];
          expect(Number.isFinite(value)).toBe(true);
        });
      }

      for (const key of MULTIPLIER_KEYS) {
        // Multipliers must not be zero — a zero multiplier would completely
        // break the economy or combat for that government type.
        it(`modifier "${key}" is not zero (would break economy)`, () => {
          const value = gov.modifiers[key];
          expect(value).not.toBe(0);
        });
      }

      // Multipliers should be positive (or at least non-negative for cost mults)
      it('constructionSpeed is positive', () => {
        expect(gov.modifiers.constructionSpeed).toBeGreaterThan(0);
      });

      it('buildingCost is positive', () => {
        expect(gov.modifiers.buildingCost).toBeGreaterThan(0);
      });

      it('populationGrowth is positive', () => {
        expect(gov.modifiers.populationGrowth).toBeGreaterThan(0);
      });
    });
  }

  it('no two governments have identical modifier objects', () => {
    const seen: string[] = [];
    for (const govType of allGovernmentTypes) {
      const key = JSON.stringify(GOVERNMENTS[govType].modifiers);
      expect(seen).not.toContain(key);
      seen.push(key);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. SPECIES VALIDATION — all 15 pass Zod, 2 racial buildings each, trait totals 36-41
// ══════════════════════════════════════════════════════════════════════════════

describe('Species — Zod validation and racial buildings', () => {
  const TRAIT_POINTS_MIN = 36;
  const TRAIT_POINTS_MAX = 41;

  for (const species of PREBUILT_SPECIES) {
    describe(`species "${species.id}"`, () => {
      it('passes Zod schema validation', () => {
        const result = SpeciesSchema.safeParse(species);
        expect(result.success).toBe(true);
      });

      it(`has trait total between ${TRAIT_POINTS_MIN} and ${TRAIT_POINTS_MAX}`, () => {
        const total = totalTraitPoints(species.traits);
        expect(total).toBeGreaterThanOrEqual(TRAIT_POINTS_MIN);
        expect(total).toBeLessThanOrEqual(TRAIT_POINTS_MAX);
      });

      it('has exactly 2 racial buildings', () => {
        const racialBuildings = Object.entries(BUILDING_DEFINITIONS).filter(
          ([_, def]) => def.racialSpeciesId === species.id,
        );
        expect(
          racialBuildings.length,
          `Expected 2 racial buildings for ${species.id}, found ${racialBuildings.length}: ${racialBuildings.map(([k]) => k).join(', ')}`,
        ).toBe(2);
      });

      it('has at least one preferred atmosphere', () => {
        expect(species.environmentPreference.preferredAtmospheres.length).toBeGreaterThanOrEqual(1);
      });

      it('has positive temperature tolerance', () => {
        expect(species.environmentPreference.temperatureTolerance).toBeGreaterThan(0);
      });

      it('has positive gravity tolerance', () => {
        expect(species.environmentPreference.gravityTolerance).toBeGreaterThan(0);
      });
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. FOOD BALANCE — hydroponics sustains up to 400,000 population
// ══════════════════════════════════════════════════════════════════════════════

describe('Food balance — hydroponics sustains population', () => {
  it('1 hydroponics bay (8 organics) sustains up to 80M population without starvation', () => {
    // 1 hydroponics bay produces 8 organics per tick
    const organicsProduced = BUILDING_DEFINITIONS.hydroponics_bay.baseProduction.organics ?? 0;
    expect(organicsProduced).toBe(8);

    // Population consumes ceil(pop / 10,000,000) organics per tick
    // At 80M: ceil(80M/10M) = 8 organics consumed
    const consumed = calculateOrganicsConsumption(80_000_000);
    expect(consumed).toBe(8);

    // 8 produced >= 8 consumed — no starvation
    expect(organicsProduced).toBeGreaterThanOrEqual(consumed);
  });

  it('80M+ population begins starvation with only 1 hydroponics bay', () => {
    // At 80,000,001: ceil(80000001/10000000) = 9 > 8
    const consumed = calculateOrganicsConsumption(80_000_001);
    expect(consumed).toBe(9);
    const organicsProduced = 8;
    expect(organicsProduced).toBeLessThan(consumed);
  });

  it('tiny population still consumes at least 1 organic', () => {
    expect(calculateOrganicsConsumption(1)).toBe(1);
    expect(calculateOrganicsConsumption(2_000_000)).toBe(1);
  });

  it('zero population consumes zero organics', () => {
    expect(calculateOrganicsConsumption(0)).toBe(0);
  });

  it('negative population is clamped to zero consumption', () => {
    expect(calculateOrganicsConsumption(-500)).toBe(0);
  });

  it('ORGANICS_PER_POPULATION is 10,000,000', () => {
    expect(ORGANICS_PER_POPULATION).toBe(10_000_000);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. STARTING CONDITIONS — 1 probe, 1 fleet, hydroponics in starting buildings
// ══════════════════════════════════════════════════════════════════════════════

describe('Starting conditions — initializeGame', () => {
  function makeSpecies(id: string): Species {
    return {
      id,
      name: `Species ${id}`,
      description: 'Test species',
      portrait: `portrait_${id}`,
      isPrebuilt: true,
      specialAbilities: [],
      traits: {
        construction: 5,
        reproduction: 5,
        research: 5,
        espionage: 5,
        economy: 5,
        combat: 5,
        diplomacy: 5,
      },
      environmentPreference: {
        idealTemperature: 288,
        temperatureTolerance: 50,
        idealGravity: 1.0,
        gravityTolerance: 0.4,
        preferredAtmospheres: ['oxygen_nitrogen'],
      },
    };
  }

  function makePlayerSetup(id: string, isAI = false): PlayerSetup {
    return {
      species: makeSpecies(id),
      empireName: `Empire ${id}`,
      color: `#${id.charCodeAt(0).toString(16).padStart(6, '0')}`,
      isAI,
    };
  }

  const config: GameSetupConfig = {
    galaxyConfig: { seed: 42, size: 'small', shape: 'elliptical', playerCount: 1 },
    players: [makePlayerSetup('alpha')],
  };

  const state = initializeGame(config);

  it('creates exactly 1 fleet for a single player', () => {
    expect(state.fleets).toHaveLength(1);
  });

  it('creates exactly 1 ship (science probe) for a single player', () => {
    expect(state.ships).toHaveLength(1);
    expect(state.ships[0]!.designId).toBe('starting_science_probe');
  });

  it('the single ship is a science probe', () => {
    const ship = state.ships[0]!;
    expect(ship.name).toContain('Science Probe');
  });

  it('the fleet contains the science probe', () => {
    const fleet = state.fleets[0]!;
    expect(fleet.ships).toHaveLength(1);
    expect(fleet.ships[0]).toBe(state.ships[0]!.id);
  });

  it('the starting colony includes a hydroponics_bay', () => {
    // Find the colonised planet
    const empire = state.empires[0]!;
    const colonisedPlanets = state.galaxy.systems
      .flatMap(s => s.planets)
      .filter(p => p.ownerId === empire.id);

    expect(colonisedPlanets.length).toBeGreaterThanOrEqual(1);

    const homePlanet = colonisedPlanets[0]!;
    const hasHydroponics = homePlanet.buildings.some(b => b.type === 'hydroponics_bay');
    expect(hasHydroponics).toBe(true);
  });

  it('the starting colony includes all 7 expected building types', () => {
    const empire = state.empires[0]!;
    const homePlanet = state.galaxy.systems
      .flatMap(s => s.planets)
      .find(p => p.ownerId === empire.id)!;

    const expectedTypes = [
      'research_lab',
      'factory',
      'population_center',
      'spaceport',
      'mining_facility',
      'power_plant',
      'hydroponics_bay',
    ];

    const buildingTypes = homePlanet.buildings.map(b => b.type);
    for (const expected of expectedTypes) {
      expect(buildingTypes).toContain(expected);
    }
  });

  it('all starting buildings are level 1', () => {
    const empire = state.empires[0]!;
    const homePlanet = state.galaxy.systems
      .flatMap(s => s.planets)
      .find(p => p.ownerId === empire.id)!;

    for (const building of homePlanet.buildings) {
      expect(building.level).toBe(1);
    }
  });
});

describe('createStartingFleet — structure', () => {
  it('returns a fleet and exactly one ship', () => {
    const { fleet, ships } = createStartingFleet('emp1', 'sys1', 'Test Empire');
    expect(ships).toHaveLength(1);
    expect(fleet.ships).toHaveLength(1);
    expect(fleet.ships[0]).toBe(ships[0]!.id);
  });

  it('the ship is a deep space probe with 10 hull points', () => {
    const { ships } = createStartingFleet('emp1', 'sys1', 'Test Empire');
    expect(ships[0]!.hullPoints).toBe(10);
    expect(ships[0]!.maxHullPoints).toBe(10);
  });

  it('fleet is positioned in the given system', () => {
    const { fleet } = createStartingFleet('emp1', 'sys42', 'Test Empire');
    expect(fleet.position.systemId).toBe('sys42');
  });

  it('fleet stance defaults to defensive', () => {
    const { fleet } = createStartingFleet('emp1', 'sys1', 'Test Empire');
    expect(fleet.stance).toBe('defensive');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. TECH TREE — all 94+ techs have valid prerequisites (no cycles, no dangling refs)
// ══════════════════════════════════════════════════════════════════════════════

describe('Tech tree — prerequisite integrity', () => {
  const allTechIds = new Set(UNIVERSAL_TECHNOLOGIES.map(t => t.id));

  it('has at least 94 technologies', () => {
    expect(UNIVERSAL_TECHNOLOGIES.length).toBeGreaterThanOrEqual(94);
  });

  it('every tech has a unique ID', () => {
    expect(allTechIds.size).toBe(UNIVERSAL_TECHNOLOGIES.length);
  });

  it('every prerequisite references an existing tech (no dangling refs)', () => {
    for (const tech of UNIVERSAL_TECHNOLOGIES) {
      for (const prereqId of tech.prerequisites) {
        expect(
          allTechIds.has(prereqId),
          `Tech "${tech.id}" references unknown prerequisite "${prereqId}"`,
        ).toBe(true);
      }
    }
  });

  it('no tech has a cycle in its prerequisite chain', () => {
    function hasCycle(id: string): boolean {
      const visited = new Set<string>();
      const stack = [id];
      while (stack.length > 0) {
        const current = stack.pop()!;
        if (visited.has(current)) continue;
        visited.add(current);
        const tech = UNIVERSAL_TECH_BY_ID[current];
        if (!tech) continue;
        for (const prereqId of tech.prerequisites) {
          if (prereqId === id) return true;
          stack.push(prereqId);
        }
      }
      return false;
    }

    for (const tech of UNIVERSAL_TECHNOLOGIES) {
      expect(hasCycle(tech.id), `Cycle detected involving tech "${tech.id}"`).toBe(false);
    }
  });

  it('no tech lists itself as its own prerequisite', () => {
    for (const tech of UNIVERSAL_TECHNOLOGIES) {
      expect(tech.prerequisites).not.toContain(tech.id);
    }
  });

  it('every tech has a positive cost', () => {
    for (const tech of UNIVERSAL_TECHNOLOGIES) {
      expect(tech.cost, `Tech "${tech.id}" has non-positive cost`).toBeGreaterThan(0);
    }
  });

  it('every tech has at least one effect', () => {
    for (const tech of UNIVERSAL_TECHNOLOGIES) {
      expect(
        tech.effects.length,
        `Tech "${tech.id}" has no effects`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('every tech belongs to a valid age', () => {
    const validAges = ['nano_atomic', 'fusion', 'nano_fusion', 'anti_matter', 'singularity'];
    for (const tech of UNIVERSAL_TECHNOLOGIES) {
      expect(validAges).toContain(tech.age);
    }
  });

  it('prerequisites never cross to a later age (no time travel)', () => {
    const ageOrder: Record<string, number> = {
      nano_atomic: 0,
      fusion: 1,
      nano_fusion: 2,
      anti_matter: 3,
      singularity: 4,
    };

    for (const tech of UNIVERSAL_TECHNOLOGIES) {
      const techOrder = ageOrder[tech.age] ?? 0;
      for (const prereqId of tech.prerequisites) {
        const prereq = UNIVERSAL_TECH_BY_ID[prereqId];
        if (prereq) {
          const prereqOrder = ageOrder[prereq.age] ?? 0;
          expect(
            prereqOrder,
            `Tech "${tech.id}" (${tech.age}) requires "${prereqId}" (${prereq.age}) which is from a later age`,
          ).toBeLessThanOrEqual(techOrder);
        }
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. TRADE ROUTES — revenue, disruption, blockade, maturity
// ══════════════════════════════════════════════════════════════════════════════

describe('Trade routes — revenue and status mechanics', () => {
  // Build a minimal galaxy for trade route tests
  function makeLinearGalaxy() {
    return {
      id: 'galaxy1',
      systems: [
        {
          id: 'sys_a',
          name: 'System A',
          position: { x: 0, y: 0 },
          starType: 'yellow' as const,
          planets: [
            {
              id: 'pa1',
              name: 'Planet A1',
              orbitalIndex: 0,
              type: 'terran' as const,
              atmosphere: 'oxygen_nitrogen' as const,
              gravity: 1.0,
              temperature: 288,
              naturalResources: 50,
              maxPopulation: 1_000_000,
              currentPopulation: 500_000,
              ownerId: 'emp1',
              buildings: [],
              productionQueue: [],
            },
          ],
          wormholes: ['sys_b'],
          ownerId: 'emp1',
          discovered: {},
        },
        {
          id: 'sys_b',
          name: 'System B',
          position: { x: 100, y: 0 },
          starType: 'yellow' as const,
          planets: [
            {
              id: 'pb1',
              name: 'Planet B1',
              orbitalIndex: 0,
              type: 'terran' as const,
              atmosphere: 'oxygen_nitrogen' as const,
              gravity: 1.0,
              temperature: 288,
              naturalResources: 50,
              maxPopulation: 1_000_000,
              currentPopulation: 500_000,
              ownerId: 'emp2',
              buildings: [],
              productionQueue: [],
            },
          ],
          wormholes: ['sys_a', 'sys_c'],
          ownerId: 'emp2',
          discovered: {},
        },
        {
          id: 'sys_c',
          name: 'System C',
          position: { x: 200, y: 0 },
          starType: 'red_dwarf' as const,
          planets: [
            {
              id: 'pc1',
              name: 'Planet C1',
              orbitalIndex: 0,
              type: 'barren' as const,
              atmosphere: 'none' as const,
              gravity: 0.5,
              temperature: 200,
              naturalResources: 30,
              maxPopulation: 500_000,
              currentPopulation: 0,
              ownerId: null,
              buildings: [],
              productionQueue: [],
            },
          ],
          wormholes: ['sys_b'],
          ownerId: null,
          discovered: {},
        },
      ],
      anomalies: [],
      minorSpecies: [],
      width: 300,
      height: 100,
      seed: 42,
    };
  }

  it('establishes a trade route between connected systems', () => {
    const galaxy = makeLinearGalaxy();
    const route = establishTradeRoute('sys_a', 'sys_b', 'emp1', 'emp2', galaxy);

    expect(route).not.toBeNull();
    expect(route!.status).toBe('establishing');
    expect(route!.age).toBe(0);
    expect(route!.revenuePerTick).toBeGreaterThan(0);
    expect(route!.partnerRevenuePerTick).toBeGreaterThan(0);
  });

  it('returns null for disconnected systems', () => {
    const galaxy = makeLinearGalaxy();
    // Remove wormholes to disconnect
    galaxy.systems[0]!.wormholes = [];
    galaxy.systems[1]!.wormholes = ['sys_c'];
    const route = establishTradeRoute('sys_a', 'sys_b', 'emp1', 'emp2', galaxy);
    expect(route).toBeNull();
  });

  it('calculates zero revenue for establishing routes', () => {
    const galaxy = makeLinearGalaxy();
    const route = establishTradeRoute('sys_a', 'sys_b', 'emp1', 'emp2', galaxy)!;
    const revenue = calculateTradeRevenue(route);
    expect(revenue.ownerRevenue).toBe(0);
    expect(revenue.partnerRevenue).toBe(0);
  });

  it('transitions from establishing to active after 5 ticks', () => {
    const galaxy = makeLinearGalaxy();
    let routes = [establishTradeRoute('sys_a', 'sys_b', 'emp1', 'emp2', galaxy)!];

    // Tick 5 times with no hostile fleets
    for (let i = 0; i < 5; i++) {
      routes = tickTradeRoutes(routes, galaxy, []);
    }

    expect(routes[0]!.status).toBe('active');
    expect(routes[0]!.age).toBe(5);
  });

  it('generates positive revenue once active', () => {
    const galaxy = makeLinearGalaxy();
    let routes = [establishTradeRoute('sys_a', 'sys_b', 'emp1', 'emp2', galaxy)!];

    for (let i = 0; i < 6; i++) {
      routes = tickTradeRoutes(routes, galaxy, []);
    }

    expect(routes[0]!.status).toBe('active');
    expect(routes[0]!.revenuePerTick).toBeGreaterThan(0);
    expect(routes[0]!.partnerRevenuePerTick).toBeGreaterThan(0);
  });

  it('maturity bonus grows over time and caps at 1.0', () => {
    const galaxy = makeLinearGalaxy();
    let routes = [establishTradeRoute('sys_a', 'sys_b', 'emp1', 'emp2', galaxy)!];

    // Tick 60 times (beyond the 50-tick maturity cap)
    for (let i = 0; i < 60; i++) {
      routes = tickTradeRoutes(routes, galaxy, []);
    }

    expect(routes[0]!.maturityBonus).toBeLessThanOrEqual(1.0);
    expect(routes[0]!.maturityBonus).toBeGreaterThan(0);
  });

  it('hostile fleet on endpoint blockades the route', () => {
    const galaxy = makeLinearGalaxy();
    let routes = [establishTradeRoute('sys_a', 'sys_b', 'emp1', 'emp2', galaxy)!];

    // Activate the route
    for (let i = 0; i < 6; i++) {
      routes = tickTradeRoutes(routes, galaxy, []);
    }
    expect(routes[0]!.status).toBe('active');

    // Place a hostile fleet at the endpoint
    const hostileFleet = {
      id: 'hostile1',
      name: 'Enemy Fleet',
      ships: ['s1'],
      empireId: 'enemy',
      position: { systemId: 'sys_b' },
      destination: null,
      waypoints: [],
      stance: 'aggressive' as const,
    };

    routes = tickTradeRoutes(routes, galaxy, [hostileFleet]);
    expect(routes[0]!.status).toBe('blockaded');
  });

  it('hostile fleet on intermediate system disrupts the route', () => {
    const galaxy = makeLinearGalaxy();
    // Create route from A to C (passing through B)
    let routes = [establishTradeRoute('sys_a', 'sys_c', 'emp1', 'emp3', galaxy)!];

    if (routes[0]) {
      // Activate the route
      for (let i = 0; i < 6; i++) {
        routes = tickTradeRoutes(routes, galaxy, []);
      }

      // Place hostile on intermediate system B
      const hostileFleet = {
        id: 'hostile1',
        name: 'Enemy Fleet',
        ships: ['s1'],
        empireId: 'enemy',
        position: { systemId: 'sys_b' },
        destination: null,
        waypoints: [],
        stance: 'aggressive' as const,
      };

      routes = tickTradeRoutes(routes, galaxy, [hostileFleet]);
      expect(routes[0]!.status).toBe('disrupted');
    }
  });

  it('rerouting cancels route if no alternative path exists', () => {
    const galaxy = makeLinearGalaxy();
    const route = establishTradeRoute('sys_a', 'sys_c', 'emp1', 'emp3', galaxy);

    if (route) {
      // Block the only intermediate system
      const result = rerouteTradeRoute(route, galaxy, ['sys_b']);
      expect(result.status).toBe('cancelled');
    }
  });

  it('cancelled routes are not modified by tickTradeRoutes', () => {
    const galaxy = makeLinearGalaxy();
    const route = establishTradeRoute('sys_a', 'sys_b', 'emp1', 'emp2', galaxy)!;
    const cancelled: TradeRoute = { ...route, status: 'cancelled' as TradeRouteStatus };

    const [ticked] = tickTradeRoutes([cancelled], galaxy, []);
    expect(ticked!.status).toBe('cancelled');
    expect(ticked!.age).toBe(cancelled.age); // Age should NOT advance
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 7. FIRST CONTACT — all approaches produce valid reactions
// ══════════════════════════════════════════════════════════════════════════════

describe('First contact — all approaches produce valid reactions', () => {
  const approaches: FirstContactApproach[] = [
    'send_greeting',
    'observe_silently',
    'display_strength',
    'open_fire',
    'flee',
    'broadcast_language',
  ];

  const validReactions: FirstContactReaction[] = [
    'friendly_response',
    'cautious_interest',
    'confusion',
    'fear_and_retreat',
    'hostile_response',
    'total_misunderstanding',
    'religious_awe',
    'assimilation_offer',
  ];

  for (const approach of approaches) {
    it(`approach "${approach}" produces a valid reaction`, () => {
      // Test with multiple roll values spanning the probability space
      for (let roll = 0; roll <= 1.0; roll += 0.1) {
        const reaction = resolveFirstContact(
          approach,
          'teranos',
          'khazari',
          false,
          false,
          5,
          5,
          roll,
        );
        expect(validReactions).toContain(reaction);
      }
    });

    it(`approach "${approach}" with xenolinguistics produces a valid reaction`, () => {
      for (let roll = 0; roll <= 1.0; roll += 0.1) {
        const reaction = resolveFirstContact(
          approach,
          'teranos',
          'vaelori',
          true,
          true,
          7,
          3,
          roll,
        );
        expect(validReactions).toContain(reaction);
      }
    });
  }

  it('open_fire always produces hostile_response', () => {
    for (let roll = 0; roll <= 1.0; roll += 0.1) {
      const reaction = resolveFirstContact(
        'open_fire',
        'khazari',
        'sylvani',
        false,
        false,
        5,
        5,
        roll,
      );
      expect(reaction).toBe('hostile_response');
    }
  });

  it('all reaction->outcome pairs produce valid outcomes', () => {
    for (const approach of approaches) {
      for (const reaction of validReactions) {
        const outcome = resolveFirstContactOutcome(approach, reaction, false, false);
        expect(outcome.initialAttitude).toBeGreaterThanOrEqual(-100);
        expect(outcome.initialAttitude).toBeLessThanOrEqual(100);
        expect(typeof outcome.relationshipEstablished).toBe('boolean');
        expect(typeof outcome.warDeclared).toBe('boolean');
        expect(typeof outcome.tradeOpened).toBe('boolean');
        expect(['none', 'basic', 'trade', 'scientific']).toContain(
          outcome.communicationLevel,
        );
      }
    }
  });

  it('extreme personality values (1/10) do not produce NaN weights', () => {
    for (const approach of approaches) {
      const reaction1 = resolveFirstContact(approach, 'a', 'b', false, false, 1, 1, 0.5);
      expect(validReactions).toContain(reaction1);

      const reaction2 = resolveFirstContact(approach, 'a', 'b', false, false, 10, 10, 0.5);
      expect(validReactions).toContain(reaction2);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 8. AI PERSONALITY — all 15 species have profiles
// ══════════════════════════════════════════════════════════════════════════════

describe('AI personality — all species have valid profiles', () => {
  const SPECIES_IDS = PREBUILT_SPECIES.map(s => s.id);

  it('SPECIES_DEFAULT_PROFILES has entries for all 15 species', () => {
    for (const id of SPECIES_IDS) {
      expect(
        SPECIES_DEFAULT_PROFILES[id],
        `Missing personality profile for species "${id}"`,
      ).toBeDefined();
    }
  });

  it('all profiles produce valid behaviour weights in 0-1 range', () => {
    for (const id of SPECIES_IDS) {
      const profile = SPECIES_DEFAULT_PROFILES[id]!;
      const weights = calculateBehaviourWeights(profile);

      const weightKeys: (keyof typeof weights)[] = [
        'warPropensity',
        'treatyReliability',
        'espionagePropensity',
        'tradePropensity',
        'victoryDrive',
        'diplomaticOpenness',
        'coldWarPropensity',
        'deceptionPropensity',
      ];

      for (const key of weightKeys) {
        expect(weights[key], `${id}.${key}`).toBeGreaterThanOrEqual(0);
        expect(weights[key], `${id}.${key}`).toBeLessThanOrEqual(1);
        expect(Number.isNaN(weights[key]), `${id}.${key} is NaN`).toBe(false);
      }
    }
  });

  it('no two species have identical personality profiles', () => {
    const seen: string[] = [];
    for (const id of SPECIES_IDS) {
      const key = JSON.stringify(SPECIES_DEFAULT_PROFILES[id]);
      expect(seen).not.toContain(key);
      seen.push(key);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 9. DEMOGRAPHICS — age progression does not produce negative populations
// ══════════════════════════════════════════════════════════════════════════════

describe('Demographics — age progression stability after 1000 ticks', () => {
  const baseModifiers: DemographicModifiers = {
    growthRate: 1.0,
    healthLevel: 60,
    educationLevel: 50,
    happiness: 20,
    isTheocracy: false,
    availableBuildings: ['factory', 'research_lab', 'population_center'],
  };

  it('population does not go negative after 1000 ticks with normal modifiers', () => {
    let demographics = createInitialDemographics(10_000, 'teranos');

    for (let tick = 0; tick < 1000; tick++) {
      demographics = tickDemographics(demographics, baseModifiers);

      expect(demographics.totalPopulation).toBeGreaterThanOrEqual(0);
      expect(demographics.age.young).toBeGreaterThanOrEqual(0);
      expect(demographics.age.workingAge).toBeGreaterThanOrEqual(0);
      expect(demographics.age.elderly).toBeGreaterThanOrEqual(0);
    }
  });

  it('population does not go negative after 1000 ticks with terrible happiness', () => {
    let demographics = createInitialDemographics(5_000, 'khazari');
    const terribleModifiers: DemographicModifiers = {
      ...baseModifiers,
      happiness: -80,
      healthLevel: 20,
      growthRate: 0.5,
    };

    for (let tick = 0; tick < 1000; tick++) {
      demographics = tickDemographics(demographics, terribleModifiers);

      expect(demographics.totalPopulation).toBeGreaterThanOrEqual(0);
      expect(demographics.age.young).toBeGreaterThanOrEqual(0);
      expect(demographics.age.workingAge).toBeGreaterThanOrEqual(0);
      expect(demographics.age.elderly).toBeGreaterThanOrEqual(0);
    }
  });

  it('population of zero stays at zero (does not produce negative births)', () => {
    let demographics = createInitialDemographics(0, 'sylvani');

    for (let tick = 0; tick < 100; tick++) {
      demographics = tickDemographics(demographics, baseModifiers);
      expect(demographics.totalPopulation).toBe(0);
    }
  });

  it('very small population (1) does not produce NaN or negative values', () => {
    let demographics = createInitialDemographics(1, 'nexari');

    for (let tick = 0; tick < 100; tick++) {
      demographics = tickDemographics(demographics, baseModifiers);
      expect(Number.isNaN(demographics.totalPopulation)).toBe(false);
      expect(demographics.totalPopulation).toBeGreaterThanOrEqual(0);
    }
  });

  it('loyalty and faith distributions never contain negative values', () => {
    let demographics = createInitialDemographics(10_000, 'orivani');
    const mixedModifiers: DemographicModifiers = {
      ...baseModifiers,
      happiness: -50,
      isTheocracy: true,
    };

    for (let tick = 0; tick < 500; tick++) {
      demographics = tickDemographics(demographics, mixedModifiers);

      expect(demographics.loyalty.loyal).toBeGreaterThanOrEqual(0);
      expect(demographics.loyalty.content).toBeGreaterThanOrEqual(0);
      expect(demographics.loyalty.disgruntled).toBeGreaterThanOrEqual(0);
      expect(demographics.loyalty.rebellious).toBeGreaterThanOrEqual(0);

      expect(demographics.faith.fanatics).toBeGreaterThanOrEqual(0);
      expect(demographics.faith.observant).toBeGreaterThanOrEqual(0);
      expect(demographics.faith.casual).toBeGreaterThanOrEqual(0);
      expect(demographics.faith.indifferent).toBeGreaterThanOrEqual(0);
      expect(demographics.faith.secular).toBeGreaterThanOrEqual(0);
    }
  });

  it('vocation totals always equal working-age population', () => {
    let demographics = createInitialDemographics(10_000, 'kaelenth');

    for (let tick = 0; tick < 200; tick++) {
      demographics = tickDemographics(demographics, baseModifiers);

      const vocSum =
        demographics.vocations.scientists +
        demographics.vocations.workers +
        demographics.vocations.military +
        demographics.vocations.merchants +
        demographics.vocations.administrators +
        demographics.vocations.educators +
        demographics.vocations.medical +
        demographics.vocations.general;

      expect(vocSum).toBe(demographics.age.workingAge);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 10. GALAXY GENERATION — anomalies and minor species
// ══════════════════════════════════════════════════════════════════════════════

describe('Galaxy generation — anomalies and minor species', () => {
  const validAnomalyTypes = [
    'precursor_ruins',
    'derelict_vessel',
    'spatial_rift',
    'mineral_deposit',
    'energy_signature',
    'sealed_wormhole',
    'debris_field',
    'living_nebula',
    'gravity_anomaly',
    'ancient_beacon',
  ];

  const validMinorBiologies = [
    'carbon_terrestrial',
    'carbon_aquatic',
    'carbon_aerial',
    'silicon_based',
    'fungal_network',
    'insectoid_swarm',
    'megafauna',
  ];

  const validMinorTechLevels = [
    'stone_age',
    'bronze_age',
    'iron_age',
    'medieval',
    'renaissance',
    'industrial',
    'early_modern',
  ];

  it('a medium galaxy generates at least 1 anomaly', () => {
    const galaxy = generateGalaxy({
      seed: 12345,
      size: 'medium',
      shape: 'spiral',
      playerCount: 4,
    });
    expect(galaxy.anomalies.length).toBeGreaterThanOrEqual(1);
  });

  it('all anomalies have valid types', () => {
    const galaxy = generateGalaxy({
      seed: 99,
      size: 'medium',
      shape: 'elliptical',
      playerCount: 2,
    });

    for (const anomaly of galaxy.anomalies) {
      expect(validAnomalyTypes).toContain(anomaly.type);
    }
  });

  it('all anomalies reference existing system IDs', () => {
    const galaxy = generateGalaxy({
      seed: 77,
      size: 'medium',
      shape: 'irregular',
      playerCount: 3,
    });

    const systemIds = new Set(galaxy.systems.map(s => s.id));
    for (const anomaly of galaxy.anomalies) {
      expect(systemIds.has(anomaly.systemId)).toBe(true);
    }
  });

  it('all anomalies have unique IDs', () => {
    const galaxy = generateGalaxy({
      seed: 55,
      size: 'large',
      shape: 'ring',
      playerCount: 4,
    });

    const anomalyIds = galaxy.anomalies.map(a => a.id);
    expect(new Set(anomalyIds).size).toBe(anomalyIds.length);
  });

  it('anomalies start undiscovered and uninvestigated', () => {
    const galaxy = generateGalaxy({
      seed: 33,
      size: 'medium',
      shape: 'spiral',
      playerCount: 2,
    });

    for (const anomaly of galaxy.anomalies) {
      expect(anomaly.discovered).toBe(false);
      expect(anomaly.investigated).toBe(false);
    }
  });

  it('a medium galaxy generates at least 1 minor species', () => {
    const galaxy = generateGalaxy({
      seed: 12345,
      size: 'medium',
      shape: 'spiral',
      playerCount: 2,
    });
    expect(galaxy.minorSpecies.length).toBeGreaterThanOrEqual(1);
  });

  it('all minor species have valid biology types', () => {
    const galaxy = generateGalaxy({
      seed: 88,
      size: 'medium',
      shape: 'elliptical',
      playerCount: 3,
    });

    for (const ms of galaxy.minorSpecies) {
      expect(validMinorBiologies).toContain(ms.biology);
    }
  });

  it('all minor species have valid tech levels', () => {
    const galaxy = generateGalaxy({
      seed: 44,
      size: 'medium',
      shape: 'spiral',
      playerCount: 2,
    });

    for (const ms of galaxy.minorSpecies) {
      expect(validMinorTechLevels).toContain(ms.techLevel);
    }
  });

  it('all minor species reference existing planets and systems', () => {
    const galaxy = generateGalaxy({
      seed: 111,
      size: 'medium',
      shape: 'elliptical',
      playerCount: 4,
    });

    const systemIds = new Set(galaxy.systems.map(s => s.id));
    const planetIds = new Set(galaxy.systems.flatMap(s => s.planets.map(p => p.id)));

    for (const ms of galaxy.minorSpecies) {
      expect(systemIds.has(ms.systemId)).toBe(true);
      expect(planetIds.has(ms.planetId)).toBe(true);
    }
  });

  it('all minor species have unique IDs', () => {
    const galaxy = generateGalaxy({
      seed: 222,
      size: 'large',
      shape: 'spiral',
      playerCount: 4,
    });

    const msIds = galaxy.minorSpecies.map(ms => ms.id);
    expect(new Set(msIds).size).toBe(msIds.length);
  });

  it('minor species traits are within 1-10 range', () => {
    const galaxy = generateGalaxy({
      seed: 333,
      size: 'medium',
      shape: 'ring',
      playerCount: 2,
    });

    for (const ms of galaxy.minorSpecies) {
      for (const key of ['aggression', 'curiosity', 'industriousness', 'adaptability'] as const) {
        expect(ms.traits[key]).toBeGreaterThanOrEqual(1);
        expect(ms.traits[key]).toBeLessThanOrEqual(10);
      }
    }
  });

  it('minor species population is positive', () => {
    const galaxy = generateGalaxy({
      seed: 444,
      size: 'medium',
      shape: 'spiral',
      playerCount: 3,
    });

    for (const ms of galaxy.minorSpecies) {
      expect(ms.population).toBeGreaterThan(0);
    }
  });

  it('minor species start undiscovered', () => {
    const galaxy = generateGalaxy({
      seed: 555,
      size: 'medium',
      shape: 'elliptical',
      playerCount: 2,
    });

    for (const ms of galaxy.minorSpecies) {
      expect(ms.status).toBe('undiscovered');
    }
  });

  it('different seeds produce different galaxies', () => {
    const g1 = generateGalaxy({
      seed: 1,
      size: 'small',
      shape: 'spiral',
      playerCount: 2,
    });
    const g2 = generateGalaxy({
      seed: 999,
      size: 'small',
      shape: 'spiral',
      playerCount: 2,
    });

    // At minimum, system positions should differ
    const positions1 = g1.systems.map(s => `${s.position.x},${s.position.y}`).sort();
    const positions2 = g2.systems.map(s => `${s.position.x},${s.position.y}`).sort();
    expect(positions1).not.toEqual(positions2);
  });
});
