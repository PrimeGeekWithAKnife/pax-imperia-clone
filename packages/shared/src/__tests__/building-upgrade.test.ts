import { describe, it, expect } from 'vitest';
import type { Planet, Building, BuildingType } from '../types/galaxy.js';
import type { TechAge } from '../types/species.js';
import {
  getMaxLevelForAge,
  getUpgradeCost,
  getUpgradeBuildTime,
  canUpgradeBuilding,
  addUpgradeToQueue,
  processConstructionQueue,
} from '../engine/colony.js';
import { BUILDING_DEFINITIONS } from '../constants/buildings.js';

function makePlanet(overrides: Partial<Planet> = {}): Planet {
  return {
    id: 'planet-1',
    name: 'Test Planet',
    orbitalIndex: 2,
    type: 'terran',
    atmosphere: 'oxygen_nitrogen',
    gravity: 1.0,
    temperature: 290,
    naturalResources: 50,
    maxPopulation: 500_000,
    currentPopulation: 100_000,
    buildings: [],
    productionQueue: [],
    ownerId: 'empire-1',
    ...overrides,
  };
}

function makeBuilding(type: BuildingType, level = 1, id?: string): Building {
  return { id: id ?? `bldg-${type}-${level}`, type, level };
}

describe('getMaxLevelForAge', () => {
  it('returns 1 for nano_atomic age (starting age — no upgrades)', () => {
    expect(getMaxLevelForAge('research_lab', 'nano_atomic')).toBe(1);
  });

  it('returns 2 for fusion age', () => {
    expect(getMaxLevelForAge('research_lab', 'fusion')).toBe(2);
  });

  it('returns 3 for nano_fusion age', () => {
    expect(getMaxLevelForAge('research_lab', 'nano_fusion')).toBe(3);
  });

  it('never exceeds the building maxLevel', () => {
    expect(getMaxLevelForAge('shipyard', 'singularity')).toBe(3);
  });

  it('returns correct cap for anti_matter and singularity', () => {
    expect(getMaxLevelForAge('factory', 'anti_matter')).toBe(4);
    expect(getMaxLevelForAge('factory', 'singularity')).toBe(5);
  });
});

describe('getUpgradeCost', () => {
  it('returns baseCost * level * 1.5 for each resource', () => {
    const cost = getUpgradeCost('research_lab', 1);
    const baseCost = BUILDING_DEFINITIONS.research_lab.baseCost;
    for (const [key, base] of Object.entries(baseCost)) {
      expect(cost[key as keyof typeof cost]).toBe(Math.ceil((base ?? 0) * 1 * 1.5));
    }
  });

  it('scales with current level', () => {
    const cost2 = getUpgradeCost('factory', 2);
    const baseCost = BUILDING_DEFINITIONS.factory.baseCost;
    for (const [key, base] of Object.entries(baseCost)) {
      expect(cost2[key as keyof typeof cost2]).toBe(Math.ceil((base ?? 0) * 2 * 1.5));
    }
  });
});

describe('getUpgradeBuildTime', () => {
  it('returns buildTime * level * 1.5', () => {
    const time = getUpgradeBuildTime('research_lab', 1);
    const base = BUILDING_DEFINITIONS.research_lab.buildTime;
    expect(time).toBe(Math.ceil(base * 1 * 1.5));
  });
});

describe('canUpgradeBuilding', () => {
  it('allows upgrade when below age-capped level', () => {
    const building = makeBuilding('research_lab', 1);
    const planet = makePlanet({ buildings: [building] });
    const result = canUpgradeBuilding(planet, building.id, 'fusion');
    expect(result.allowed).toBe(true);
  });

  it('rejects upgrade when at age-capped level even if below maxLevel', () => {
    const building = makeBuilding('research_lab', 1);
    const planet = makePlanet({ buildings: [building] });
    const result = canUpgradeBuilding(planet, building.id, 'nano_atomic');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/age|technology/i);
  });

  it('rejects upgrade when already at maxLevel', () => {
    const maxLevel = BUILDING_DEFINITIONS.research_lab.maxLevel;
    const building = makeBuilding('research_lab', maxLevel);
    const planet = makePlanet({ buildings: [building] });
    const result = canUpgradeBuilding(planet, building.id, 'singularity');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/max/i);
  });

  it('rejects upgrade when building not found', () => {
    const planet = makePlanet({ buildings: [] });
    const result = canUpgradeBuilding(planet, 'nonexistent', 'fusion');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/not found/i);
  });

  it('rejects upgrade when an upgrade for the same building is already queued', () => {
    const building = makeBuilding('research_lab', 1);
    const planet = makePlanet({
      buildings: [building],
      productionQueue: [{
        type: 'building_upgrade',
        templateId: 'research_lab',
        turnsRemaining: 50,
        targetBuildingId: building.id,
      }],
    });
    const result = canUpgradeBuilding(planet, building.id, 'fusion');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/already.*queue/i);
  });
});

describe('addUpgradeToQueue', () => {
  it('adds a building_upgrade item to the production queue', () => {
    const building = makeBuilding('factory', 1);
    const planet = makePlanet({ buildings: [building] });
    const updated = addUpgradeToQueue(planet, building.id, 'fusion');
    const item = updated.productionQueue.find(
      q => q.type === 'building_upgrade' && q.targetBuildingId === building.id,
    );
    expect(item).toBeDefined();
    expect(item!.templateId).toBe('factory');
    expect(item!.turnsRemaining).toBe(getUpgradeBuildTime('factory', 1));
    expect(item!.totalTurns).toBe(getUpgradeBuildTime('factory', 1));
  });

  it('throws when the building cannot be upgraded', () => {
    const maxLevel = BUILDING_DEFINITIONS.factory.maxLevel;
    const building = makeBuilding('factory', maxLevel);
    const planet = makePlanet({ buildings: [building] });
    expect(() => addUpgradeToQueue(planet, building.id, 'singularity')).toThrow();
  });
});

describe('processConstructionQueue — building_upgrade', () => {
  it('increments building level when upgrade completes', () => {
    const building = makeBuilding('research_lab', 2);
    const planet = makePlanet({
      buildings: [building],
      productionQueue: [{
        type: 'building_upgrade',
        templateId: 'research_lab',
        turnsRemaining: 1,
        targetBuildingId: building.id,
      }],
    });
    const updated = processConstructionQueue(planet, 10);
    const upgraded = updated.buildings.find(b => b.id === building.id);
    expect(upgraded).toBeDefined();
    expect(upgraded!.level).toBe(3);
    expect(updated.productionQueue.length).toBe(0);
  });

  it('resets condition to 100 on upgrade completion', () => {
    const building: Building = { id: 'b1', type: 'factory', level: 1, condition: 50 };
    const planet = makePlanet({
      buildings: [building],
      productionQueue: [{
        type: 'building_upgrade',
        templateId: 'factory',
        turnsRemaining: 1,
        targetBuildingId: building.id,
      }],
    });
    const updated = processConstructionQueue(planet, 10);
    const upgraded = updated.buildings.find(b => b.id === building.id);
    expect(upgraded!.condition).toBe(100);
  });
});
