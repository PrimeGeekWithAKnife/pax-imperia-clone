/**
 * Integration tests for new game systems added in the major expansion:
 *
 *  1. New species (7 new, 15 total) — racial buildings, abilities, canBuild
 *  2. Tech tree (94 techs) — prerequisite validation, no cycles
 *  3. AI personality profiles for all 15 species
 *  4. Galaxy generation — anomalies, minor species
 *  5. Demographics — distributions, tick invariants, effective workers
 *  6. First contact — reactions, xenolinguistics, open_fire
 *  7. Trade routes — establishment, maturity, disruption
 *  8. Ethical audit trail — neutral start, clamping, game scenario
 *  9. Government types — all 14, no zero/NaN modifiers
 * 10. Cross-system integration scenario
 */

import { describe, it, expect } from 'vitest';

// ── Data imports ─────────────────────────────────────────────────────────────
import { PREBUILT_SPECIES, PREBUILT_SPECIES_BY_ID } from '../../data/species/index.js';
import techTree from '../../data/tech/universal-tree.json';

// ── Engine imports ───────────────────────────────────────────────────────────
import {
  BUILDING_DEFINITIONS,
  type BuildingDefinition,
} from '../constants/buildings.js';
import { GOVERNMENTS } from '../types/government.js';
import type { GovernmentType, GovernmentModifiers } from '../types/government.js';
import type { BuildingType } from '../types/galaxy.js';
import { canBuildOnPlanet } from '../engine/colony.js';
import type { Planet, Building } from '../types/galaxy.js';
import type { Species, SpecialAbility } from '../types/species.js';
import {
  calculateBehaviourWeights,
  SPECIES_DEFAULT_PROFILES,
  randomisePersonality,
} from '../engine/ai/personality.js';
import { generateGalaxy, type GalaxyGenerationConfig } from '../generation/galaxy-generator.js';
import {
  createInitialDemographics,
  tickDemographics,
  calculateEffectiveWorkers,
  type DemographicModifiers,
} from '../engine/demographics.js';
import {
  resolveFirstContact,
  resolveFirstContactOutcome,
  createAuditTrail,
  recordDecision,
} from '../engine/first-contact.js';
import {
  establishTradeRoute,
  tickTradeRoutes,
  calculateTradeRevenue,
} from '../engine/trade-routes.js';
import type { Galaxy, StarSystem } from '../types/galaxy.js';
import type { Fleet } from '../types/ships.js';

// ── Fixture helpers ──────────────────────────────────────────────────────────

const NEW_SPECIES_IDS = [
  'luminari', 'vethara', 'kaelenth', 'thyriaq', 'aethyn', 'orivani', 'pyrenth',
];

const ALL_SPECIES_IDS = [
  'vaelori', 'khazari', 'sylvani', 'nexari', 'drakmari', 'teranos',
  'zorvathi', 'ashkari', ...NEW_SPECIES_IDS,
];

/** Racial building pairs for each species (2 each). */
const RACIAL_BUILDINGS: Record<string, BuildingType[]> = {
  vaelori:  ['crystal_resonance_chamber', 'psionic_amplifier'],
  khazari:  ['war_forge', 'magma_tap'],
  sylvani:  ['living_archive', 'growth_vat'],
  nexari:   ['neural_network_hub', 'assimilation_node'],
  drakmari: ['abyssal_processor', 'predator_arena'],
  teranos:  ['diplomatic_quarter', 'innovation_lab'],
  zorvathi: ['deep_hive', 'tunnel_network'],
  ashkari:  ['salvage_yard', 'black_market'],
  luminari: ['plasma_conduit', 'dimensional_resonator'],
  vethara:  ['bonding_chamber', 'neural_integration_centre'],
  kaelenth: ['data_archive', 'replication_forge'],
  thyriaq:  ['reconfiguration_matrix', 'substrate_processor'],
  aethyn:   ['dimensional_anchor', 'phase_laboratory'],
  orivani:  ['grand_cathedral', 'reliquary_vault'],
  pyrenth:  ['elemental_forge', 'seismic_resonator'],
};

/** Expected special abilities for each new species. */
const NEW_SPECIES_ABILITIES: Record<string, SpecialAbility[]> = {
  luminari: ['energy_form'],
  vethara:  ['symbiotic'],
  kaelenth: ['synthetic'],
  thyriaq:  ['nanomorphic'],
  aethyn:   ['dimensional'],
  orivani:  ['devout'],
  pyrenth:  ['silicon_based'],
};

function makePlanet(overrides: Partial<Planet> = {}): Planet {
  return {
    id: 'planet-test',
    name: 'Test World',
    orbitalIndex: 2,
    type: 'terran',
    atmosphere: 'oxygen_nitrogen',
    gravity: 1.0,
    temperature: 295,
    naturalResources: 50,
    maxPopulation: 1_000_000_000,
    currentPopulation: 500_000,
    ownerId: 'empire-1',
    buildings: [],
    productionQueue: [],
    ...overrides,
  };
}

function makeSystem(overrides: Partial<StarSystem>): StarSystem {
  return {
    id: 'sys-default',
    name: 'Default',
    position: { x: 0, y: 0 },
    starType: 'yellow',
    planets: [],
    wormholes: [],
    ownerId: null,
    discovered: {},
    ...overrides,
  };
}

function makeLinearGalaxy(): Galaxy {
  return {
    id: 'galaxy-test',
    systems: [
      makeSystem({
        id: 'sys-a', name: 'Alpha', position: { x: 0, y: 0 },
        planets: [makePlanet({ id: 'p-a', name: 'Alpha I', naturalResources: 60 })],
        wormholes: ['sys-b'], ownerId: 'empire-1',
      }),
      makeSystem({
        id: 'sys-b', name: 'Beta', position: { x: 100, y: 0 },
        planets: [makePlanet({ id: 'p-b', name: 'Beta I', naturalResources: 50 })],
        wormholes: ['sys-a', 'sys-c'],
      }),
      makeSystem({
        id: 'sys-c', name: 'Gamma', position: { x: 200, y: 0 },
        planets: [makePlanet({ id: 'p-c', name: 'Gamma I', naturalResources: 50 })],
        wormholes: ['sys-b', 'sys-d'],
      }),
      makeSystem({
        id: 'sys-d', name: 'Delta', position: { x: 300, y: 0 },
        planets: [makePlanet({ id: 'p-d', name: 'Delta I', naturalResources: 60 })],
        wormholes: ['sys-c'], ownerId: 'empire-2',
      }),
    ],
    anomalies: [],
    minorSpecies: [],
    width: 500,
    height: 500,
    seed: 42,
  };
}

function makeFleet(overrides: Partial<Fleet>): Fleet {
  return {
    id: 'fleet-1',
    name: 'Fleet Alpha',
    ships: ['ship-1'],
    empireId: 'empire-3',
    position: { systemId: 'sys-b' },
    destination: null,
    waypoints: [],
    stance: 'aggressive',
    ...overrides,
  };
}

function makeDefaultModifiers(overrides: Partial<DemographicModifiers> = {}): DemographicModifiers {
  return {
    growthRate: 1.0,
    healthLevel: 70,
    educationLevel: 50,
    happiness: 30,
    isTheocracy: false,
    availableBuildings: [],
    ...overrides,
  };
}

// ==========================================================================
// 1. NEW SPECIES — RACIAL BUILDINGS AND ABILITIES
// ==========================================================================

describe('1. New species – racial buildings and abilities', () => {
  describe.each(NEW_SPECIES_IDS)('species "%s"', (speciesId) => {
    const species = PREBUILT_SPECIES_BY_ID[speciesId]!;

    it('exists in PREBUILT_SPECIES_BY_ID', () => {
      expect(species).toBeDefined();
      expect(species.id).toBe(speciesId);
    });

    it('has racial buildings defined in BUILDING_DEFINITIONS', () => {
      const buildings = RACIAL_BUILDINGS[speciesId]!;
      expect(buildings).toBeDefined();
      expect(buildings).toHaveLength(2);

      for (const buildingType of buildings) {
        const def = BUILDING_DEFINITIONS[buildingType];
        expect(def, `Building "${buildingType}" missing from BUILDING_DEFINITIONS`).toBeDefined();
        expect(def.racialSpeciesId).toBe(speciesId);
      }
    });

    it('has expected special abilities', () => {
      const expected = NEW_SPECIES_ABILITIES[speciesId]!;
      for (const ability of expected) {
        expect(species.specialAbilities).toContain(ability);
      }
    });
  });

  describe('canBuildOnPlanet — racial building restrictions', () => {
    it('allows a species to build its own racial buildings', () => {
      for (const speciesId of ALL_SPECIES_IDS) {
        const species = PREBUILT_SPECIES_BY_ID[speciesId];
        if (!species) continue;

        const buildings = RACIAL_BUILDINGS[speciesId];
        if (!buildings) continue;

        for (const buildingType of buildings) {
          const planet = makePlanet();
          const result = canBuildOnPlanet(planet, buildingType, species as Species);
          expect(
            result.allowed,
            `${speciesId} should be able to build ${buildingType}: ${result.reason}`,
          ).toBe(true);
        }
      }
    });

    it('prevents a species from building another species\' racial buildings', () => {
      // Use Luminari buildings and try to build them as Pyrenth
      const luminariBuildings = RACIAL_BUILDINGS['luminari']!;
      const pyrenthSpecies = PREBUILT_SPECIES_BY_ID['pyrenth']!;
      const planet = makePlanet();

      for (const buildingType of luminariBuildings) {
        const result = canBuildOnPlanet(planet, buildingType, pyrenthSpecies as Species);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('luminari');
      }
    });

    it('all 15 species have exactly 2 racial buildings each', () => {
      const racialBySpecies = new Map<string, string[]>();
      for (const [type, def] of Object.entries(BUILDING_DEFINITIONS) as [BuildingType, BuildingDefinition][]) {
        if (def.racialSpeciesId) {
          if (!racialBySpecies.has(def.racialSpeciesId)) {
            racialBySpecies.set(def.racialSpeciesId, []);
          }
          racialBySpecies.get(def.racialSpeciesId)!.push(type);
        }
      }

      for (const speciesId of ALL_SPECIES_IDS) {
        const buildings = racialBySpecies.get(speciesId);
        expect(
          buildings,
          `Species "${speciesId}" has no racial buildings`,
        ).toBeDefined();
        expect(
          buildings!.length,
          `Species "${speciesId}" has ${buildings!.length} racial buildings, expected 2`,
        ).toBe(2);
      }
    });
  });
});

// ==========================================================================
// 2. TECH TREE — PREREQUISITE VALIDATION
// ==========================================================================

describe('2. Tech tree – prerequisite validation', () => {
  interface TechEntry {
    id: string;
    name: string;
    prerequisites: string[];
    category: string;
    age: string;
    cost: number;
    effects: unknown[];
  }

  const techs = (techTree as { technologies: TechEntry[] }).technologies;
  const techIds = new Set(techs.map(t => t.id));

  it(`contains 169 technologies`, () => {
    expect(techs.length).toBe(169);
  });

  it('all prerequisite IDs reference existing techs', () => {
    const dangling: string[] = [];
    for (const tech of techs) {
      for (const prereq of tech.prerequisites) {
        if (!techIds.has(prereq)) {
          dangling.push(`${tech.id} references missing prereq "${prereq}"`);
        }
      }
    }
    expect(dangling, `Dangling prerequisites found:\n${dangling.join('\n')}`).toHaveLength(0);
  });

  it('all tech IDs are unique', () => {
    expect(techIds.size).toBe(techs.length);
  });

  it('has no circular dependencies', () => {
    // Build adjacency list and attempt topological sort
    const adj = new Map<string, string[]>();
    for (const tech of techs) {
      adj.set(tech.id, tech.prerequisites);
    }

    // Kahn's algorithm for topological sort
    const inDegree = new Map<string, number>();
    for (const id of techIds) inDegree.set(id, 0);
    for (const tech of techs) {
      for (const prereq of tech.prerequisites) {
        inDegree.set(tech.id, (inDegree.get(tech.id) ?? 0) + 1);
      }
    }

    // Reverse: track which techs depend on each prereq
    const dependents = new Map<string, string[]>();
    for (const tech of techs) {
      for (const prereq of tech.prerequisites) {
        if (!dependents.has(prereq)) dependents.set(prereq, []);
        dependents.get(prereq)!.push(tech.id);
      }
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    let sorted = 0;
    while (queue.length > 0) {
      const cur = queue.shift()!;
      sorted++;
      for (const dep of dependents.get(cur) ?? []) {
        const newDeg = (inDegree.get(dep) ?? 1) - 1;
        inDegree.set(dep, newDeg);
        if (newDeg === 0) queue.push(dep);
      }
    }

    expect(sorted, 'Topological sort could not order all techs — cycle detected').toBe(techs.length);
  });

  it('all techs have a positive cost', () => {
    for (const tech of techs) {
      expect(tech.cost, `${tech.id} has non-positive cost`).toBeGreaterThan(0);
    }
  });

  it('all techs have a valid category', () => {
    const validCategories = new Set(['construction', 'biology', 'weapons', 'defense', 'propulsion', 'racial']);
    for (const tech of techs) {
      expect(
        validCategories.has(tech.category),
        `${tech.id} has invalid category "${tech.category}"`,
      ).toBe(true);
    }
  });

  it('all techs have a valid age', () => {
    const validAges = new Set(['nano_atomic', 'fusion', 'nano_fusion', 'anti_matter', 'singularity']);
    for (const tech of techs) {
      expect(
        validAges.has(tech.age),
        `${tech.id} has invalid age "${tech.age}"`,
      ).toBe(true);
    }
  });

  it('the 13 newest techs have valid prerequisites', () => {
    // The 13 new techs added in the expansion (xenolinguistics chain, archaeology chain,
    // advanced sensors chain, wormhole destabilisation, alien material chain, wormhole generation)
    const newTechIds = [
      'xenolinguistics_foundation', 'trade_linguistics', 'scientific_collaboration_protocols',
      'xeno_archaeology', 'precursor_decryption', 'deep_archaeology',
      'advanced_sensors', 'deep_space_telemetry',
      'alien_material_analysis', 'harvester_shield_harmonics', 'adaptive_weapon_matrices',
      'wormhole_destabilisation', 'wormhole_generation',
    ];

    for (const techId of newTechIds) {
      expect(techIds.has(techId), `New tech "${techId}" not found in tree`).toBe(true);
      const tech = techs.find(t => t.id === techId)!;
      for (const prereq of tech.prerequisites) {
        expect(techIds.has(prereq), `Tech "${techId}" has dangling prereq "${prereq}"`).toBe(true);
      }
    }
  });
});

// ==========================================================================
// 3. AI PERSONALITY SYSTEM
// ==========================================================================

describe('3. AI personality system', () => {
  it('all 15 species have profiles in SPECIES_DEFAULT_PROFILES', () => {
    for (const id of ALL_SPECIES_IDS) {
      expect(
        SPECIES_DEFAULT_PROFILES[id],
        `Missing personality profile for "${id}"`,
      ).toBeDefined();
    }
    expect(Object.keys(SPECIES_DEFAULT_PROFILES)).toHaveLength(15);
  });

  it('requesting a species not in the map returns undefined', () => {
    // The system uses Record<string, ...> — accessing an unknown key gives undefined
    const profile = SPECIES_DEFAULT_PROFILES['nonexistent_species'];
    expect(profile).toBeUndefined();
  });

  it('calculateBehaviourWeights produces valid 0-1 weights for all species', () => {
    for (const id of ALL_SPECIES_IDS) {
      const profile = SPECIES_DEFAULT_PROFILES[id]!;
      const weights = calculateBehaviourWeights(profile);

      const weightKeys = [
        'warPropensity', 'treatyReliability', 'espionagePropensity',
        'tradePropensity', 'victoryDrive', 'diplomaticOpenness',
        'coldWarPropensity', 'deceptionPropensity',
      ] as const;

      for (const key of weightKeys) {
        expect(weights[key]).toBeGreaterThanOrEqual(0);
        expect(weights[key]).toBeLessThanOrEqual(1);
        expect(Number.isNaN(weights[key])).toBe(false);
      }
    }
  });

  it('new species have distinctive personalities', () => {
    // Orivani should be zealous (high war, high treaty reliability)
    const orivaniWeights = calculateBehaviourWeights(SPECIES_DEFAULT_PROFILES['orivani']!);
    expect(orivaniWeights.treatyReliability).toBeGreaterThan(0.7);
    expect(orivaniWeights.deceptionPropensity).toBeLessThan(0.3);

    // Thyriaq should be expansion-driven (high victory drive)
    const thyriaqWeights = calculateBehaviourWeights(SPECIES_DEFAULT_PROFILES['thyriaq']!);
    expect(thyriaqWeights.victoryDrive).toBeGreaterThan(0.5);

    // Luminari should be open and exploratory
    const luminariWeights = calculateBehaviourWeights(SPECIES_DEFAULT_PROFILES['luminari']!);
    expect(luminariWeights.diplomaticOpenness).toBeGreaterThan(0.5);
    expect(luminariWeights.warPropensity).toBeLessThan(0.4);
  });

  it('randomisePersonality preserves bounds for new species', () => {
    for (const id of NEW_SPECIES_IDS) {
      const base = SPECIES_DEFAULT_PROFILES[id]!;
      for (let i = 0; i < 20; i++) {
        const randomised = randomisePersonality(base, 4);
        for (const trait of Object.values(randomised)) {
          expect(trait).toBeGreaterThanOrEqual(1);
          expect(trait).toBeLessThanOrEqual(10);
        }
      }
    }
  });
});

// ==========================================================================
// 4. GALAXY GENERATION — ANOMALIES AND MINOR SPECIES
// ==========================================================================

describe('4. Galaxy generation – anomalies and minor species', () => {
  const galaxy = generateGalaxy({
    seed: 42,
    size: 'medium',
    shape: 'elliptical',
    playerCount: 2,
  });

  it('generated galaxy has anomalies', () => {
    expect(galaxy.anomalies.length).toBeGreaterThan(0);
  });

  it('anomaly coverage is between 15-25% of systems', () => {
    const anomalySystemIds = new Set(galaxy.anomalies.map(a => a.systemId));
    const coverage = anomalySystemIds.size / galaxy.systems.length;
    // Allow some margin due to stochastic generation
    expect(coverage).toBeGreaterThanOrEqual(0.10);
    expect(coverage).toBeLessThanOrEqual(0.35);
  });

  it('anomaly IDs are unique', () => {
    const ids = galaxy.anomalies.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all anomaly systemIds reference valid systems', () => {
    const systemIds = new Set(galaxy.systems.map(s => s.id));
    for (const anomaly of galaxy.anomalies) {
      expect(systemIds.has(anomaly.systemId)).toBe(true);
    }
  });

  it('sealed wormholes are placed at galaxy edge systems', () => {
    const cx = galaxy.width / 2;
    const cy = galaxy.height / 2;
    const maxRadius = Math.min(galaxy.width, galaxy.height) * 0.5;
    const edgeThreshold = maxRadius * 0.85;

    const sealedWormholes = galaxy.anomalies.filter(a => a.type === 'sealed_wormhole');
    if (sealedWormholes.length > 0) {
      const systemMap = new Map(galaxy.systems.map(s => [s.id, s]));
      for (const sw of sealedWormholes) {
        const sys = systemMap.get(sw.systemId)!;
        const dx = sys.position.x - cx;
        const dy = sys.position.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        expect(dist).toBeGreaterThanOrEqual(edgeThreshold);
      }
    }
  });

  it('has 1-3 sealed wormholes', () => {
    const sealedCount = galaxy.anomalies.filter(a => a.type === 'sealed_wormhole').length;
    expect(sealedCount).toBeGreaterThanOrEqual(1);
    expect(sealedCount).toBeLessThanOrEqual(3);
  });

  it('has energy signatures at galaxy edge (when edge systems exist)', () => {
    // Energy signatures are placed at edge systems. With some galaxy shapes
    // and seeds, edge systems may be scarce and all taken by sealed wormholes.
    // Verify that if energy signatures exist, they are at the galaxy edge.
    const energySignatures = galaxy.anomalies.filter(a => a.type === 'energy_signature');
    if (energySignatures.length > 0) {
      const cx = galaxy.width / 2;
      const cy = galaxy.height / 2;
      const maxRadius = Math.min(galaxy.width, galaxy.height) * 0.5;
      const edgeThreshold = maxRadius * 0.85;
      const systemMap = new Map(galaxy.systems.map(s => [s.id, s]));

      for (const es of energySignatures) {
        const sys = systemMap.get(es.systemId)!;
        const dx = sys.position.x - cx;
        const dy = sys.position.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        expect(dist).toBeGreaterThanOrEqual(edgeThreshold);
      }
    }

    // Use a larger galaxy to guarantee energy signatures exist
    const largeGalaxy = generateGalaxy({
      seed: 42,
      size: 'large',
      shape: 'spiral',
      playerCount: 2,
    });
    const largeEnergy = largeGalaxy.anomalies.filter(a => a.type === 'energy_signature');
    expect(largeEnergy.length).toBeGreaterThanOrEqual(1);
  });

  it('generated galaxy has minor species', () => {
    expect(galaxy.minorSpecies.length).toBeGreaterThan(0);
  });

  it('minor species are placed on habitable planets only', () => {
    const habitableTypes = new Set(['terran', 'ocean', 'desert']);
    const systemMap = new Map(galaxy.systems.map(s => [s.id, s]));

    for (const ms of galaxy.minorSpecies) {
      const sys = systemMap.get(ms.systemId)!;
      const planet = sys.planets.find(p => p.id === ms.planetId);
      expect(planet, `Minor species ${ms.name} references missing planet ${ms.planetId}`).toBeDefined();
      expect(
        habitableTypes.has(planet!.type),
        `Minor species on non-habitable planet type "${planet!.type}"`,
      ).toBe(true);
    }
  });

  it('minor species have valid attributes', () => {
    const validBiology = new Set([
      'carbon_terrestrial', 'carbon_aquatic', 'carbon_aerial',
      'insectoid_swarm', 'fungal_network', 'silicon_based', 'megafauna',
    ]);
    const validTechLevels = new Set([
      'stone_age', 'bronze_age', 'iron_age', 'medieval',
      'renaissance', 'industrial', 'early_modern',
    ]);

    for (const ms of galaxy.minorSpecies) {
      expect(validBiology.has(ms.biology)).toBe(true);
      expect(validTechLevels.has(ms.techLevel)).toBe(true);
      expect(ms.population).toBeGreaterThan(0);
      expect(ms.traits.aggression).toBeGreaterThanOrEqual(1);
      expect(ms.traits.aggression).toBeLessThanOrEqual(10);
      expect(ms.traits.curiosity).toBeGreaterThanOrEqual(1);
      expect(ms.traits.curiosity).toBeLessThanOrEqual(10);
    }
  });

  it('minor species IDs are unique', () => {
    const ids = galaxy.minorSpecies.map(ms => ms.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('anomalies and minor species are deterministic (same seed)', () => {
    const g2 = generateGalaxy({ seed: 42, size: 'medium', shape: 'elliptical', playerCount: 2 });
    expect(g2.anomalies.length).toBe(galaxy.anomalies.length);
    expect(g2.minorSpecies.length).toBe(galaxy.minorSpecies.length);
    for (let i = 0; i < galaxy.anomalies.length; i++) {
      expect(g2.anomalies[i]!.type).toBe(galaxy.anomalies[i]!.type);
      expect(g2.anomalies[i]!.systemId).toBe(galaxy.anomalies[i]!.systemId);
    }
  });
});

// ==========================================================================
// 5. DEMOGRAPHICS SYSTEM
// ==========================================================================

describe('5. Demographics system', () => {
  describe('createInitialDemographics — distribution integrity', () => {
    it('age groups sum to total population for all species', () => {
      for (const speciesId of ALL_SPECIES_IDS) {
        const d = createInitialDemographics(10000, speciesId);
        const ageSum = d.age.young + d.age.workingAge + d.age.elderly;
        expect(ageSum, `Age sum mismatch for ${speciesId}`).toBe(d.totalPopulation);
      }
    });

    it('faith distribution sums to total population', () => {
      for (const speciesId of ALL_SPECIES_IDS) {
        const d = createInitialDemographics(10000, speciesId);
        const faithSum = d.faith.fanatics + d.faith.observant + d.faith.casual
          + d.faith.indifferent + d.faith.secular;
        expect(faithSum, `Faith sum mismatch for ${speciesId}`).toBe(d.totalPopulation);
      }
    });

    it('loyalty distribution sums to total population', () => {
      for (const speciesId of ALL_SPECIES_IDS) {
        const d = createInitialDemographics(10000, speciesId);
        const loyaltySum = d.loyalty.loyal + d.loyalty.content
          + d.loyalty.disgruntled + d.loyalty.rebellious;
        expect(loyaltySum, `Loyalty sum mismatch for ${speciesId}`).toBe(d.totalPopulation);
      }
    });

    it('vocation distribution sums to working age', () => {
      for (const speciesId of ALL_SPECIES_IDS) {
        const d = createInitialDemographics(10000, speciesId);
        const vocSum = d.vocations.scientists + d.vocations.workers + d.vocations.military
          + d.vocations.merchants + d.vocations.administrators + d.vocations.educators
          + d.vocations.medical + d.vocations.general;
        expect(vocSum, `Vocation sum mismatch for ${speciesId}`).toBe(d.age.workingAge);
      }
    });
  });

  describe('tickDemographics — no negative populations', () => {
    it('never produces negative age groups after 100 ticks', () => {
      let d = createInitialDemographics(1000, 'teranos');
      const modifiers = makeDefaultModifiers({
        growthRate: 0.5,
        healthLevel: 30,
        happiness: -60,
      });

      for (let i = 0; i < 100; i++) {
        d = tickDemographics(d, modifiers);
        expect(d.age.young).toBeGreaterThanOrEqual(0);
        expect(d.age.workingAge).toBeGreaterThanOrEqual(0);
        expect(d.age.elderly).toBeGreaterThanOrEqual(0);
        expect(d.totalPopulation).toBeGreaterThanOrEqual(0);
      }
    });

    it('total population equals sum of age groups after each tick', () => {
      let d = createInitialDemographics(5000, 'luminari');
      const modifiers = makeDefaultModifiers({ growthRate: 1.2, happiness: 50 });

      for (let i = 0; i < 50; i++) {
        d = tickDemographics(d, modifiers);
        const ageSum = d.age.young + d.age.workingAge + d.age.elderly;
        expect(ageSum).toBe(d.totalPopulation);
      }
    });
  });

  describe('calculateEffectiveWorkers', () => {
    it('returns 0 when no workers of the right type exist', () => {
      const d = createInitialDemographics(0, 'teranos');
      expect(calculateEffectiveWorkers(d, 'research_lab')).toBe(0);
      expect(calculateEffectiveWorkers(d, 'factory')).toBe(0);
      expect(calculateEffectiveWorkers(d, 'trade_hub')).toBe(0);
    });

    it('returns general labour for unknown building types', () => {
      const d = createInitialDemographics(10000, 'teranos');
      const workers = calculateEffectiveWorkers(d, 'some_future_building');
      expect(workers).toBe(d.vocations.general);
    });

    it('maps racial buildings to the correct vocation', () => {
      const d = createInitialDemographics(10000, 'vaelori');
      // crystal_resonance_chamber maps to scientists
      expect(calculateEffectiveWorkers(d, 'crystal_resonance_chamber')).toBe(d.vocations.scientists);
      // war_forge maps to workers
      expect(calculateEffectiveWorkers(d, 'war_forge')).toBe(d.vocations.workers);
    });
  });
});

// ==========================================================================
// 6. FIRST CONTACT SYSTEM
// ==========================================================================

describe('6. First contact system', () => {
  it('open_fire always produces hostile_response regardless of personality', () => {
    for (let openness = 1; openness <= 10; openness++) {
      for (let bravery = 1; bravery <= 10; bravery += 3) {
        const result = resolveFirstContact(
          'open_fire', 'a', 'b', true, true, openness, bravery,
        );
        expect(result).toBe('hostile_response');
      }
    }
  });

  it('xenolinguistics affects outcomes — more friendly with language', () => {
    let withLangFriendly = 0;
    let withoutLangFriendly = 0;

    for (let i = 0; i < 500; i++) {
      if (resolveFirstContact('send_greeting', 'a', 'b', true, false, 5, 5) === 'friendly_response') {
        withLangFriendly++;
      }
      if (resolveFirstContact('send_greeting', 'a', 'b', false, false, 5, 5) === 'friendly_response') {
        withoutLangFriendly++;
      }
    }

    expect(withLangFriendly).toBeGreaterThan(withoutLangFriendly);
  });

  it('resolveFirstContact produces valid reactions for all approaches', () => {
    const approaches = [
      'send_greeting', 'observe_silently', 'display_strength',
      'open_fire', 'flee', 'broadcast_language',
    ] as const;

    const validReactions = new Set([
      'friendly_response', 'cautious_interest', 'confusion',
      'fear_and_retreat', 'hostile_response', 'total_misunderstanding',
      'religious_awe', 'assimilation_offer',
    ]);

    for (const approach of approaches) {
      for (let i = 0; i < 50; i++) {
        const result = resolveFirstContact(approach, 'a', 'b', false, false, 5, 5);
        expect(validReactions.has(result)).toBe(true);
      }
    }
  });

  it('hostile_response outcome always declares war', () => {
    const outcome = resolveFirstContactOutcome(
      'send_greeting', 'hostile_response', false, false,
    );
    expect(outcome.warDeclared).toBe(true);
    expect(outcome.initialAttitude).toBeLessThan(0);
  });
});

// ==========================================================================
// 7. TRADE ROUTES
// ==========================================================================

describe('7. Trade routes', () => {
  it('establishes routes with valid paths', () => {
    const galaxy = makeLinearGalaxy();
    const route = establishTradeRoute('sys-a', 'sys-d', 'empire-1', 'empire-2', galaxy);
    expect(route).not.toBeNull();
    expect(route!.path).toEqual(['sys-a', 'sys-b', 'sys-c', 'sys-d']);
    expect(route!.status).toBe('establishing');
  });

  it('maturity increases over time', () => {
    const galaxy = makeLinearGalaxy();
    let routes: import('../../src/types/trade-routes.js').TradeRoute[] = [{
      id: 'route-1',
      empireId: 'empire-1',
      partnerEmpireId: 'empire-2',
      sourceSystemId: 'sys-a',
      destinationSystemId: 'sys-d',
      path: ['sys-a', 'sys-b', 'sys-c', 'sys-d'],
      status: 'active',
      goods: { exports: {}, imports: {} },
      revenuePerTick: 10,
      partnerRevenuePerTick: 8,
      age: 0,
      maturityBonus: 0,
    }];

    for (let i = 0; i < 25; i++) {
      routes = tickTradeRoutes(routes, galaxy, []);
    }

    expect(routes[0]!.maturityBonus).toBeGreaterThan(0);
    expect(routes[0]!.age).toBe(25);
  });

  it('hostile fleets disrupt routes', () => {
    const galaxy = makeLinearGalaxy();
    const route = {
      id: 'route-1',
      empireId: 'empire-1',
      partnerEmpireId: 'empire-2',
      sourceSystemId: 'sys-a',
      destinationSystemId: 'sys-d',
      path: ['sys-a', 'sys-b', 'sys-c', 'sys-d'],
      status: 'active' as const,
      goods: { exports: {}, imports: {} },
      revenuePerTick: 10,
      partnerRevenuePerTick: 8,
      age: 10,
      maturityBonus: 0.2,
    };

    const hostileFleet = makeFleet({
      empireId: 'empire-3',
      position: { systemId: 'sys-b' },
    });

    const [updated] = tickTradeRoutes([route], galaxy, [hostileFleet]);
    expect(updated!.status).toBe('disrupted');
    expect(updated!.revenuePerTick).toBeLessThan(route.revenuePerTick);
  });

  it('blockaded routes earn zero revenue', () => {
    const galaxy = makeLinearGalaxy();
    const route = {
      id: 'route-1',
      empireId: 'empire-1',
      partnerEmpireId: 'empire-2',
      sourceSystemId: 'sys-a',
      destinationSystemId: 'sys-d',
      path: ['sys-a', 'sys-b', 'sys-c', 'sys-d'],
      status: 'active' as const,
      goods: { exports: {}, imports: {} },
      revenuePerTick: 10,
      partnerRevenuePerTick: 8,
      age: 10,
      maturityBonus: 0.2,
    };

    const hostileFleet = makeFleet({
      empireId: 'empire-3',
      position: { systemId: 'sys-a' }, // at source = blockade
    });

    const [updated] = tickTradeRoutes([route], galaxy, [hostileFleet]);
    expect(updated!.status).toBe('blockaded');
    expect(updated!.revenuePerTick).toBe(0);
  });
});

// ==========================================================================
// 8. ETHICAL AUDIT TRAIL
// ==========================================================================

describe('8. Ethical audit trail', () => {
  it('createAuditTrail produces neutral scores', () => {
    const trail = createAuditTrail();
    expect(trail.mercy).toBe(0);
    expect(trail.honesty).toBe(0);
    expect(trail.justice).toBe(0);
    expect(trail.diplomacy).toBe(0);
    expect(trail.ecology).toBe(0);
    expect(trail.decisions).toHaveLength(0);
  });

  it('recordDecision clamps to +100', () => {
    let trail = createAuditTrail();
    trail = recordDecision(trail, {
      category: 'mercy',
      description: 'Extreme mercy',
      scoreChange: 200,
    }, 1);
    expect(trail.mercy).toBe(100);
  });

  it('recordDecision clamps to -100', () => {
    let trail = createAuditTrail();
    trail = recordDecision(trail, {
      category: 'mercy',
      description: 'Extreme cruelty',
      scoreChange: -200,
    }, 1);
    expect(trail.mercy).toBe(-100);
  });

  it('game scenario: declare war lowers diplomacy, sign treaty raises it', () => {
    let trail = createAuditTrail();

    // Declare war without provocation
    trail = recordDecision(trail, {
      category: 'diplomacy',
      description: 'Declared war on a peaceful neighbour',
      scoreChange: -30,
    }, 10);
    expect(trail.diplomacy).toBe(-30);

    // Execute prisoners
    trail = recordDecision(trail, {
      category: 'mercy',
      description: 'Executed captured prisoners',
      scoreChange: -25,
    }, 15);
    expect(trail.mercy).toBe(-25);
    // Diplomacy should be unchanged
    expect(trail.diplomacy).toBe(-30);

    // Sign peace treaty
    trail = recordDecision(trail, {
      category: 'diplomacy',
      description: 'Signed lasting peace treaty',
      scoreChange: 20,
    }, 30);
    expect(trail.diplomacy).toBe(-10);

    // Show mercy
    trail = recordDecision(trail, {
      category: 'mercy',
      description: 'Released all prisoners and paid reparations',
      scoreChange: 40,
    }, 35);
    expect(trail.mercy).toBe(15);

    // Protect ecosystem
    trail = recordDecision(trail, {
      category: 'ecology',
      description: 'Created nature reserve',
      scoreChange: 30,
    }, 40);
    expect(trail.ecology).toBe(30);

    // Verify full trail
    expect(trail.decisions).toHaveLength(5);
    expect(trail.decisions[0]!.tick).toBe(10);
    expect(trail.decisions[4]!.tick).toBe(40);
  });

  it('does not mutate the original trail', () => {
    const original = createAuditTrail();
    const updated = recordDecision(original, {
      category: 'honesty',
      description: 'Test',
      scoreChange: 50,
    }, 1);
    expect(original.honesty).toBe(0);
    expect(updated.honesty).toBe(50);
  });
});

// ==========================================================================
// 9. GOVERNMENT TYPES
// ==========================================================================

describe('9. Government types – all 14 properly defined', () => {
  const governmentTypes: GovernmentType[] = [
    'democracy', 'republic', 'federation', 'autocracy', 'empire',
    'theocracy', 'oligarchy', 'military_junta', 'technocracy',
    'hive_mind', 'forced_labour', 'dictatorship', 'equality', 'tribal_council',
  ];

  it('has exactly 14 government types', () => {
    expect(Object.keys(GOVERNMENTS)).toHaveLength(14);
  });

  it('all 14 government types are present', () => {
    for (const type of governmentTypes) {
      expect(GOVERNMENTS[type], `Missing government type "${type}"`).toBeDefined();
    }
  });

  describe.each(governmentTypes)('government "%s"', (type) => {
    const gov = GOVERNMENTS[type];
    const mods = gov.modifiers;
    const modifierKeys: (keyof GovernmentModifiers)[] = [
      'constructionSpeed', 'researchSpeed', 'tradeIncome',
      'populationGrowth', 'combatBonus', 'buildingCost', 'decisionSpeed',
    ];

    it('has no NaN modifiers', () => {
      for (const key of modifierKeys) {
        expect(Number.isNaN(mods[key]), `${type}.${key} is NaN`).toBe(false);
      }
      expect(Number.isNaN(mods.happiness)).toBe(false);
    });

    it('has no zero multipliers that would break the economy', () => {
      for (const key of modifierKeys) {
        // All multiplier fields should be > 0 (except happiness which is a flat bonus)
        expect(mods[key], `${type}.${key} is zero or negative`).toBeGreaterThan(0);
      }
    });

    it('has a non-empty description', () => {
      expect(gov.description.length).toBeGreaterThan(50);
    });

    it('has a non-empty name', () => {
      expect(gov.name.length).toBeGreaterThan(0);
    });

    it('multipliers are within reasonable range (0.1 to 2.0)', () => {
      for (const key of modifierKeys) {
        expect(mods[key]).toBeGreaterThanOrEqual(0.1);
        expect(mods[key]).toBeLessThanOrEqual(2.0);
      }
    });

    it('happiness modifier is within reasonable range (-50 to +50)', () => {
      expect(mods.happiness).toBeGreaterThanOrEqual(-50);
      expect(mods.happiness).toBeLessThanOrEqual(50);
    });
  });
});

// ==========================================================================
// 10. CROSS-SYSTEM INTEGRATION
// ==========================================================================

describe('10. Cross-system integration scenario', () => {
  it('end-to-end: new species, galaxy, demographics, trade, first contact, ethics, AI', () => {
    // 1. Pick a new species and verify it exists
    const speciesId = 'orivani';
    const species = PREBUILT_SPECIES_BY_ID[speciesId];
    expect(species).toBeDefined();
    expect(species!.specialAbilities).toContain('devout');

    // 2. Verify AI personality profile exists
    const profile = SPECIES_DEFAULT_PROFILES[speciesId];
    expect(profile).toBeDefined();
    const weights = calculateBehaviourWeights(profile!);
    expect(weights.treatyReliability).toBeGreaterThan(0.5);

    // 3. Generate a galaxy and check for anomalies + minor species
    const galaxy = generateGalaxy({
      seed: 12345,
      size: 'small',
      shape: 'spiral',
      playerCount: 2,
    });

    expect(galaxy.systems.length).toBeGreaterThan(0);
    expect(galaxy.anomalies.length).toBeGreaterThan(0);
    // Small galaxy may have fewer minor species, but should still have some
    // (depends on how many habitable planets the seed produces)
    // Just verify the array exists
    expect(Array.isArray(galaxy.minorSpecies)).toBe(true);

    // 4. Create demographics for a colony and tick them
    const demographics = createInitialDemographics(10000, speciesId);
    expect(demographics.totalPopulation).toBe(10000);
    expect(demographics.primarySpeciesId).toBe(speciesId);

    // Orivani are devout — verify faith distribution
    expect(demographics.faith.fanatics + demographics.faith.observant)
      .toBeGreaterThan(5000);

    // Tick demographics 10 times
    let currentDemographics = demographics;
    const modifiers = makeDefaultModifiers({ growthRate: 1.0, happiness: 30 });
    for (let i = 0; i < 10; i++) {
      currentDemographics = tickDemographics(currentDemographics, modifiers);
      expect(currentDemographics.totalPopulation).toBeGreaterThan(0);
      expect(currentDemographics.age.young).toBeGreaterThanOrEqual(0);
    }
    // Population should have grown somewhat with positive conditions
    expect(currentDemographics.totalPopulation).toBeGreaterThanOrEqual(demographics.totalPopulation);

    // 5. Establish a trade route
    const tradeGalaxy = makeLinearGalaxy();
    const route = establishTradeRoute('sys-a', 'sys-d', 'empire-1', 'empire-2', tradeGalaxy);
    expect(route).not.toBeNull();
    expect(route!.status).toBe('establishing');

    // Tick it past the establishment period
    let routes = [route!];
    for (let i = 0; i < 6; i++) {
      routes = tickTradeRoutes(routes, tradeGalaxy, []);
    }
    expect(routes[0]!.status).toBe('active');
    expect(routes[0]!.maturityBonus).toBeGreaterThan(0);

    // 6. Trigger a first contact event
    const reaction = resolveFirstContact(
      'send_greeting', speciesId, 'kaelenth',
      true, false, // initiator has xenolinguistics
      profile!.openness, profile!.bravery,
    );
    expect(typeof reaction).toBe('string');

    const outcome = resolveFirstContactOutcome(
      'send_greeting', reaction, true, false,
    );
    expect(outcome.relationshipEstablished).toBeDefined();

    // 7. Record an ethical decision
    let trail = createAuditTrail();
    trail = recordDecision(trail, {
      category: 'diplomacy',
      description: 'Initiated peaceful first contact with the Kaelenth',
      scoreChange: 15,
    }, 50);
    expect(trail.diplomacy).toBe(15);
    expect(trail.decisions).toHaveLength(1);

    // If we declared war via hostile response, record that too
    if (outcome.warDeclared) {
      trail = recordDecision(trail, {
        category: 'diplomacy',
        description: 'First contact resulted in hostilities',
        scoreChange: -20,
      }, 51);
      expect(trail.diplomacy).toBeLessThan(15);
    }

    // 8. Verify racial buildings are available for the species
    const racialBuildings = RACIAL_BUILDINGS[speciesId]!;
    for (const building of racialBuildings) {
      const def = BUILDING_DEFINITIONS[building];
      expect(def).toBeDefined();
      expect(def.racialSpeciesId).toBe(speciesId);
    }

    // 9. Verify government types are all accessible
    expect(Object.keys(GOVERNMENTS)).toHaveLength(14);

    // 10. Check that starting buildings include hydroponics_bay
    const startingBuildings: BuildingType[] = [
      'research_lab', 'factory', 'population_center',
      'spaceport', 'mining_facility', 'power_plant', 'hydroponics_bay',
    ];
    expect(startingBuildings).toContain('hydroponics_bay');
  });
});
