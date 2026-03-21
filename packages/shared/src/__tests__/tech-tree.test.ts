import { describe, it, expect } from 'vitest';
import {
  UNIVERSAL_TECH_TREE,
  UNIVERSAL_TECHNOLOGIES,
  UNIVERSAL_TECH_BY_ID,
} from '../../data/tech/index.js';
import { TechTreeSchema, TechnologySchema } from '../validation/technology.js';
import type { TechCategory } from '../types/technology.js';
import type { TechAge } from '../types/species.js';
import type { HullClass } from '../types/ships.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_AGES: TechAge[] = [
  'diamond_age',
  'spatial_dark_age',
  'neo_renaissance',
  'fusion_age',
  'age_of_star_empires',
];

const ALL_CATEGORIES: TechCategory[] = [
  'weapons',
  'defense',
  'propulsion',
  'biology',
  'construction',
  'special',
];

/** Minimum cost for each age — costs must be at least this high. */
const AGE_MIN_COST: Record<TechAge, number> = {
  diamond_age: 50,
  spatial_dark_age: 200,
  neo_renaissance: 500,
  fusion_age: 1000,
  age_of_star_empires: 1500,
};

const VALID_HULL_CLASSES: HullClass[] = [
  'scout',
  'destroyer',
  'transport',
  'cruiser',
  'carrier',
  'battleship',
];

// ── Helpers ───────────────────────────────────────────────────────────────────



/** Returns true if following prereqs from `id` ever loops back to `id`. */
function hasCycle(id: string, techById: typeof UNIVERSAL_TECH_BY_ID): boolean {
  const visited = new Set<string>();
  const stack = [id];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const tech = techById[current];
    if (!tech) continue;
    for (const prereq of tech.prerequisites) {
      if (prereq === id) return true;
      stack.push(prereq);
    }
  }
  return false;
}

// ── Top-level structure ───────────────────────────────────────────────────────

describe('Universal tech tree — top-level structure', () => {
  it('has a technologies array with at least 60 entries', () => {
    expect(UNIVERSAL_TECHNOLOGIES.length).toBeGreaterThanOrEqual(60);
  });

  it('has an ageGates object', () => {
    expect(UNIVERSAL_TECH_TREE.ageGates).toBeDefined();
    expect(typeof UNIVERSAL_TECH_TREE.ageGates).toBe('object');
  });

  it('UNIVERSAL_TECH_BY_ID contains all technologies', () => {
    for (const tech of UNIVERSAL_TECHNOLOGIES) {
      expect(UNIVERSAL_TECH_BY_ID[tech.id]).toBeDefined();
    }
  });

  it('UNIVERSAL_TECH_BY_ID has no extra keys', () => {
    expect(Object.keys(UNIVERSAL_TECH_BY_ID)).toHaveLength(UNIVERSAL_TECHNOLOGIES.length);
  });
});

// ── Zod validation ────────────────────────────────────────────────────────────

describe('Universal tech tree — Zod schema validation', () => {
  it('validates the entire tech tree against TechTreeSchema', () => {
    const result = TechTreeSchema.safeParse(UNIVERSAL_TECH_TREE);
    if (!result.success) {
      throw new Error(
        `TechTree validation failed:\n${result.error.issues
          .map((i) => `  ${i.path.join('.')}: ${i.message}`)
          .join('\n')}`,
      );
    }
    expect(result.success).toBe(true);
  });

  describe.each(UNIVERSAL_TECHNOLOGIES.map((t) => [t.id, t] as [string, typeof t]))(
    'tech "%s"',
    (id, tech) => {
      it('passes TechnologySchema validation', () => {
        const result = TechnologySchema.safeParse(tech);
        if (!result.success) {
          throw new Error(
            `Validation failed for tech "${id}":\n${result.error.issues
              .map((i) => `  ${i.path.join('.')}: ${i.message}`)
              .join('\n')}`,
          );
        }
        expect(result.success).toBe(true);
      });
    },
  );
});

// ── Uniqueness ────────────────────────────────────────────────────────────────

describe('Universal tech tree — uniqueness', () => {
  it('all tech IDs are unique', () => {
    const ids = UNIVERSAL_TECHNOLOGIES.map((t) => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('all tech names are unique', () => {
    const names = UNIVERSAL_TECHNOLOGIES.map((t) => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});

// ── Prerequisite integrity ────────────────────────────────────────────────────

describe('Universal tech tree — prerequisite integrity', () => {
  it('all prerequisites reference existing tech IDs', () => {
    const ids = new Set(UNIVERSAL_TECHNOLOGIES.map((t) => t.id));
    for (const tech of UNIVERSAL_TECHNOLOGIES) {
      for (const prereq of tech.prerequisites) {
        expect(
          ids.has(prereq),
          `Tech "${tech.id}" has unknown prerequisite "${prereq}"`,
        ).toBe(true);
      }
    }
  });

  it('no tech is its own prerequisite', () => {
    for (const tech of UNIVERSAL_TECHNOLOGIES) {
      expect(
        tech.prerequisites.includes(tech.id),
        `Tech "${tech.id}" lists itself as a prerequisite`,
      ).toBe(false);
    }
  });

  it('no circular dependencies exist', () => {
    for (const tech of UNIVERSAL_TECHNOLOGIES) {
      expect(
        hasCycle(tech.id, UNIVERSAL_TECH_BY_ID),
        `Circular dependency detected involving tech "${tech.id}"`,
      ).toBe(false);
    }
  });

  it('Dawn age techs have no prerequisites outside Diamond Age', () => {
    const dawnTechs = UNIVERSAL_TECHNOLOGIES.filter((t) => t.age === 'diamond_age');
    const dawnIds = new Set(dawnTechs.map((t) => t.id));
    for (const tech of dawnTechs) {
      for (const prereq of tech.prerequisites) {
        expect(
          dawnIds.has(prereq),
          `Dawn tech "${tech.id}" has prerequisite "${prereq}" from a later age`,
        ).toBe(true);
      }
    }
  });
});

// ── Age gates ─────────────────────────────────────────────────────────────────

describe('Universal tech tree — age gates', () => {
  it('age gates reference valid tech IDs', () => {
    const allIds = new Set(UNIVERSAL_TECHNOLOGIES.map((t) => t.id));
    for (const [age, gateIds] of Object.entries(UNIVERSAL_TECH_TREE.ageGates)) {
      for (const gateId of gateIds as string[]) {
        expect(
          allIds.has(gateId),
          `Age gate for "${age}" references unknown tech "${gateId}"`,
        ).toBe(true);
      }
    }
  });

  it('age gates exist for every age except the first', () => {
    const gatedAges: TechAge[] = [
      'spatial_dark_age',
      'neo_renaissance',
      'fusion_age',
      'age_of_star_empires',
    ];
    for (const age of gatedAges) {
      expect(
        UNIVERSAL_TECH_TREE.ageGates[age],
        `No age gate defined for "${age}"`,
      ).toBeDefined();
      expect(
        (UNIVERSAL_TECH_TREE.ageGates[age] as string[]).length,
        `Age gate for "${age}" is empty`,
      ).toBeGreaterThan(0);
    }
  });

  it('each age gate tech has an age_unlock effect pointing to the correct age', () => {
    for (const [unlockedAge, gateIds] of Object.entries(UNIVERSAL_TECH_TREE.ageGates)) {
      for (const gateId of gateIds as string[]) {
        const tech = UNIVERSAL_TECH_BY_ID[gateId];
        expect(tech, `Gate tech "${gateId}" not found`).toBeDefined();
        const ageUnlockEffect = tech?.effects.find((e) => e.type === 'age_unlock');
        expect(
          ageUnlockEffect,
          `Gate tech "${gateId}" has no age_unlock effect`,
        ).toBeDefined();
        if (ageUnlockEffect?.type === 'age_unlock') {
          expect(ageUnlockEffect.age).toBe(unlockedAge);
        }
      }
    }
  });
});

// ── Category coverage per age ─────────────────────────────────────────────────

describe('Universal tech tree — category coverage per age', () => {
  for (const age of ALL_AGES) {
    it(`"${age}" contains techs from all 6 categories`, () => {
      const techsInAge = UNIVERSAL_TECHNOLOGIES.filter((t) => t.age === age);
      const categoriesPresent = new Set(techsInAge.map((t) => t.category));
      for (const category of ALL_CATEGORIES) {
        expect(
          categoriesPresent.has(category),
          `Age "${age}" has no techs in category "${category}"`,
        ).toBe(true);
      }
    });
  }
});

// ── Cost scaling ──────────────────────────────────────────────────────────────

describe('Universal tech tree — cost scaling', () => {
  it('all techs in each age meet the minimum cost threshold', () => {
    for (const tech of UNIVERSAL_TECHNOLOGIES) {
      const minCost = AGE_MIN_COST[tech.age];
      expect(
        tech.cost,
        `Tech "${tech.id}" (age: ${tech.age}) has cost ${tech.cost} below minimum ${minCost}`,
      ).toBeGreaterThanOrEqual(minCost);
    }
  });

  it('average cost increases with each age', () => {
    const avgCostByAge = ALL_AGES.map((age) => {
      const techs = UNIVERSAL_TECHNOLOGIES.filter((t) => t.age === age);
      const total = techs.reduce((sum, t) => sum + t.cost, 0);
      return total / techs.length;
    });

    for (let i = 1; i < avgCostByAge.length; i++) {
      expect(
        avgCostByAge[i],
        `Average cost of age ${ALL_AGES[i]} (${avgCostByAge[i]?.toFixed(0)}) should exceed average cost of age ${ALL_AGES[i - 1]} (${avgCostByAge[i - 1]?.toFixed(0)})`,
      ).toBeGreaterThan(avgCostByAge[i - 1]!);
    }
  });
});

// ── Hull unlock effects ───────────────────────────────────────────────────────

describe('Universal tech tree — hull unlock effects', () => {
  it('all unlock_hull effects reference valid hull classes', () => {
    const validHulls = new Set<string>(VALID_HULL_CLASSES);
    for (const tech of UNIVERSAL_TECHNOLOGIES) {
      for (const effect of tech.effects) {
        if (effect.type === 'unlock_hull') {
          expect(
            validHulls.has(effect.hullClass),
            `Tech "${tech.id}" unlocks unknown hull class "${effect.hullClass}"`,
          ).toBe(true);
        }
      }
    }
  });

  it('cruiser is unlocked in the expansion age (spatial_dark_age)', () => {
    const cruiserTechs = UNIVERSAL_TECHNOLOGIES.filter((t) =>
      t.effects.some((e) => e.type === 'unlock_hull' && e.hullClass === 'cruiser'),
    );
    expect(cruiserTechs.length).toBeGreaterThan(0);
    for (const tech of cruiserTechs) {
      expect(tech.age).toBe('spatial_dark_age');
    }
  });

  it('carrier is unlocked in ascendancy age (neo_renaissance)', () => {
    const carrierTechs = UNIVERSAL_TECHNOLOGIES.filter((t) =>
      t.effects.some((e) => e.type === 'unlock_hull' && e.hullClass === 'carrier'),
    );
    expect(carrierTechs.length).toBeGreaterThan(0);
    for (const tech of carrierTechs) {
      expect(tech.age).toBe('neo_renaissance');
    }
  });

  it('battleship is unlocked in the dominion age (fusion_age)', () => {
    const bsTechs = UNIVERSAL_TECHNOLOGIES.filter((t) =>
      t.effects.some((e) => e.type === 'unlock_hull' && e.hullClass === 'battleship'),
    );
    expect(bsTechs.length).toBeGreaterThan(0);
    for (const tech of bsTechs) {
      expect(tech.age).toBe('fusion_age');
    }
  });
});

// ── Description quality ───────────────────────────────────────────────────────

describe('Universal tech tree — description quality', () => {
  it('all techs have a description of at least 50 characters', () => {
    for (const tech of UNIVERSAL_TECHNOLOGIES) {
      expect(
        tech.description.trim().length,
        `Tech "${tech.id}" has a very short description`,
      ).toBeGreaterThanOrEqual(50);
    }
  });
});

// ── Prerequisite reachability ─────────────────────────────────────────────────

describe('Universal tech tree — prerequisite reachability', () => {
  it('every tech is reachable from zero prerequisites (no orphans)', () => {
    // A tech is reachable if it has no prerequisites, OR all its prerequisites
    // are themselves reachable. We compute the full reachable set iteratively.
    const reachable = new Set<string>();
    let progress = true;
    while (progress) {
      progress = false;
      for (const tech of UNIVERSAL_TECHNOLOGIES) {
        if (reachable.has(tech.id)) continue;
        if (tech.prerequisites.every((p) => reachable.has(p))) {
          reachable.add(tech.id);
          progress = true;
        }
      }
    }
    for (const tech of UNIVERSAL_TECHNOLOGIES) {
      expect(
        reachable.has(tech.id),
        `Tech "${tech.id}" is unreachable — its prerequisites form an unsatisfiable chain`,
      ).toBe(true);
    }
  });
});

// ── Age_unlock effects are in the correct age ────────────────────────────────

describe('Universal tech tree — age_unlock effects', () => {
  it('age_unlock effects do not unlock the same age the tech belongs to', () => {
    for (const tech of UNIVERSAL_TECHNOLOGIES) {
      for (const effect of tech.effects) {
        if (effect.type === 'age_unlock') {
          expect(
            effect.age,
            `Tech "${tech.id}" unlocks the same age it belongs to`,
          ).not.toBe(tech.age);
        }
      }
    }
  });

  it('age_unlock effects only unlock the immediately following age', () => {
    for (const tech of UNIVERSAL_TECHNOLOGIES) {
      const currentAgeIndex = ALL_AGES.indexOf(tech.age);
      for (const effect of tech.effects) {
        if (effect.type === 'age_unlock') {
          const unlockedAgeIndex = ALL_AGES.indexOf(effect.age);
          expect(
            unlockedAgeIndex,
            `Tech "${tech.id}" unlocks age "${effect.age}" which is not the immediately following age`,
          ).toBe(currentAgeIndex + 1);
        }
      }
    }
  });
});
