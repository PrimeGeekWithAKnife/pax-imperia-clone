import { describe, it, expect } from 'vitest';
import { generateGalaxy } from '../generation/galaxy-generator.js';
import { GALAXY_SIZES } from '../constants/game.js';
import type { GalaxyGenerationConfig } from '../generation/galaxy-generator.js';
import type { GalaxySize } from '../constants/game.js';

// ── helpers ───────────────────────────────────────────────────────────────────

/** Returns the set of all system IDs reachable from `startId` via BFS. */
function bfsReachable(
  systems: { id: string; wormholes: string[] }[],
  startId: string,
): Set<string> {
  const visited = new Set<string>();
  const queue = [startId];
  visited.add(startId);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const sys = systems.find(s => s.id === cur)!;
    for (const nb of sys.wormholes) {
      if (!visited.has(nb)) {
        visited.add(nb);
        queue.push(nb);
      }
    }
  }
  return visited;
}

function baseConfig(overrides?: Partial<GalaxyGenerationConfig>): GalaxyGenerationConfig {
  return {
    seed: 42,
    size: 'small',
    shape: 'elliptical',
    playerCount: 2,
    ...overrides,
  };
}

// ── system count ──────────────────────────────────────────────────────────────

describe('generateGalaxy – system counts', () => {
  const sizes: GalaxySize[] = ['small', 'medium', 'large', 'huge'];

  for (const size of sizes) {
    it(`generates exactly ${GALAXY_SIZES[size]} systems for size "${size}"`, () => {
      const galaxy = generateGalaxy(baseConfig({ size }));
      expect(galaxy.systems).toHaveLength(GALAXY_SIZES[size]);
    });
  }
});

// ── graph connectivity ────────────────────────────────────────────────────────

describe('generateGalaxy – graph connectivity', () => {
  it('the galaxy graph is fully connected (small)', () => {
    const galaxy = generateGalaxy(baseConfig({ size: 'small' }));
    const reachable = bfsReachable(galaxy.systems, galaxy.systems[0]!.id);
    expect(reachable.size).toBe(galaxy.systems.length);
  });

  it('the galaxy graph is fully connected (medium)', () => {
    const galaxy = generateGalaxy(baseConfig({ size: 'medium' }));
    const reachable = bfsReachable(galaxy.systems, galaxy.systems[0]!.id);
    expect(reachable.size).toBe(galaxy.systems.length);
  });

  it('the galaxy graph is fully connected (large)', () => {
    const galaxy = generateGalaxy(baseConfig({ size: 'large' }));
    const reachable = bfsReachable(galaxy.systems, galaxy.systems[0]!.id);
    expect(reachable.size).toBe(galaxy.systems.length);
  });

  it('no system is isolated (every system has >= 1 wormhole)', () => {
    const galaxy = generateGalaxy(baseConfig({ size: 'medium' }));
    for (const sys of galaxy.systems) {
      expect(sys.wormholes.length, `system "${sys.name}" (${sys.id}) has no wormholes`).toBeGreaterThanOrEqual(1);
    }
  });

  it('wormhole connections are bidirectional', () => {
    const galaxy = generateGalaxy(baseConfig({ size: 'medium' }));
    const idMap = new Map(galaxy.systems.map(s => [s.id, s]));
    for (const sys of galaxy.systems) {
      for (const nb of sys.wormholes) {
        const nbSys = idMap.get(nb)!;
        expect(
          nbSys.wormholes,
          `edge ${sys.id}→${nb} exists but reverse ${nb}→${sys.id} does not`,
        ).toContain(sys.id);
      }
    }
  });

  it('maximum wormhole degree is 4', () => {
    const galaxy = generateGalaxy(baseConfig({ size: 'medium' }));
    for (const sys of galaxy.systems) {
      expect(
        sys.wormholes.length,
        `system "${sys.name}" has ${sys.wormholes.length} wormholes (max 4)`,
      ).toBeLessThanOrEqual(4);
    }
  });
});

// ── positions ─────────────────────────────────────────────────────────────────

describe('generateGalaxy – star positions', () => {
  it('all systems lie within galaxy bounds', () => {
    const galaxy = generateGalaxy(baseConfig({ size: 'medium' }));
    for (const sys of galaxy.systems) {
      expect(sys.position.x).toBeGreaterThanOrEqual(0);
      expect(sys.position.x).toBeLessThanOrEqual(galaxy.width);
      expect(sys.position.y).toBeGreaterThanOrEqual(0);
      expect(sys.position.y).toBeLessThanOrEqual(galaxy.height);
    }
  });

  it('galaxy stores the seed and dimensions', () => {
    const galaxy = generateGalaxy(baseConfig({ seed: 12345 }));
    expect(galaxy.seed).toBe(12345);
    expect(galaxy.width).toBeGreaterThan(0);
    expect(galaxy.height).toBeGreaterThan(0);
  });
});

// ── planet attributes ─────────────────────────────────────────────────────────

describe('generateGalaxy – planet attributes', () => {
  it('gravity is within [0.1, 3.0] for all planets', () => {
    const galaxy = generateGalaxy(baseConfig({ size: 'medium', seed: 7 }));
    for (const sys of galaxy.systems) {
      for (const planet of sys.planets) {
        expect(planet.gravity).toBeGreaterThanOrEqual(0.1);
        expect(planet.gravity).toBeLessThanOrEqual(3.0);
      }
    }
  });

  it('temperature is within [50, 1500] Kelvin for all planets', () => {
    const galaxy = generateGalaxy(baseConfig({ size: 'medium', seed: 7 }));
    for (const sys of galaxy.systems) {
      for (const planet of sys.planets) {
        expect(planet.temperature).toBeGreaterThanOrEqual(50);
        expect(planet.temperature).toBeLessThanOrEqual(1500);
      }
    }
  });

  it('naturalResources is within [0, 100] for all planets', () => {
    const galaxy = generateGalaxy(baseConfig({ size: 'medium', seed: 7 }));
    for (const sys of galaxy.systems) {
      for (const planet of sys.planets) {
        expect(planet.naturalResources).toBeGreaterThanOrEqual(0);
        expect(planet.naturalResources).toBeLessThanOrEqual(100);
      }
    }
  });

  it('each planet has a valid type', () => {
    const validTypes = new Set([
      'terran', 'ocean', 'desert', 'ice', 'volcanic', 'gas_giant', 'barren', 'toxic',
    ]);
    const galaxy = generateGalaxy(baseConfig({ size: 'medium', seed: 7 }));
    for (const sys of galaxy.systems) {
      for (const planet of sys.planets) {
        expect(validTypes.has(planet.type), `unknown planet type "${planet.type}"`).toBe(true);
      }
    }
  });

  it('planet orbital indices are 0-based and sequential', () => {
    const galaxy = generateGalaxy(baseConfig({ size: 'small', seed: 17 }));
    for (const sys of galaxy.systems) {
      sys.planets.forEach((planet, idx) => {
        expect(planet.orbitalIndex).toBe(idx);
      });
    }
  });

  it('planet IDs are unique within a galaxy', () => {
    const galaxy = generateGalaxy(baseConfig({ size: 'medium', seed: 7 }));
    const ids = galaxy.systems.flatMap(s => s.planets.map(p => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── star type distribution ────────────────────────────────────────────────────

describe('generateGalaxy – star type distribution', () => {
  it('all star types are valid', () => {
    const validTypes = new Set([
      'blue_giant', 'white', 'yellow', 'orange',
      'red_dwarf', 'red_giant', 'neutron', 'binary',
    ]);
    const galaxy = generateGalaxy(baseConfig({ size: 'large', seed: 99 }));
    for (const sys of galaxy.systems) {
      expect(validTypes.has(sys.starType), `unknown star type "${sys.starType}"`).toBe(true);
    }
  });

  it('galaxy contains a variety of star types (large galaxy)', () => {
    const galaxy = generateGalaxy(baseConfig({ size: 'large', seed: 42 }));
    const types = new Set(galaxy.systems.map(s => s.starType));
    // A large galaxy should have at least 4 different star types
    expect(types.size).toBeGreaterThanOrEqual(4);
  });

  it('neutron stars are rare relative to yellow/orange/red_dwarf', () => {
    const galaxy = generateGalaxy(baseConfig({ size: 'huge', seed: 1 }));
    const counts: Record<string, number> = {};
    for (const sys of galaxy.systems) {
      counts[sys.starType] = (counts[sys.starType] ?? 0) + 1;
    }
    const neutronCount = counts['neutron'] ?? 0;
    const commonCount = (counts['yellow'] ?? 0) + (counts['orange'] ?? 0) + (counts['red_dwarf'] ?? 0);
    expect(commonCount).toBeGreaterThan(neutronCount * 3);
  });
});

// ── shapes ────────────────────────────────────────────────────────────────────

describe('generateGalaxy – shapes', () => {
  const shapes = ['spiral', 'elliptical', 'irregular', 'ring'] as const;

  for (const shape of shapes) {
    it(`generates a connected galaxy with shape "${shape}"`, () => {
      const galaxy = generateGalaxy(baseConfig({ size: 'small', shape, seed: 55 }));
      expect(galaxy.systems).toHaveLength(GALAXY_SIZES.small);
      const reachable = bfsReachable(galaxy.systems, galaxy.systems[0]!.id);
      expect(reachable.size).toBe(galaxy.systems.length);
    });
  }
});

// ── determinism ───────────────────────────────────────────────────────────────

describe('generateGalaxy – determinism', () => {
  it('same seed produces identical galaxy', () => {
    const cfg = baseConfig({ seed: 314159, size: 'medium', shape: 'spiral' });
    const g1 = generateGalaxy(cfg);
    const g2 = generateGalaxy(cfg);

    expect(g1.systems.length).toBe(g2.systems.length);

    for (let i = 0; i < g1.systems.length; i++) {
      const s1 = g1.systems[i]!;
      const s2 = g2.systems[i]!;
      expect(s1.id).toBe(s2.id);
      expect(s1.name).toBe(s2.name);
      expect(s1.starType).toBe(s2.starType);
      expect(s1.position.x).toBe(s2.position.x);
      expect(s1.position.y).toBe(s2.position.y);
      expect(s1.wormholes.slice().sort()).toEqual(s2.wormholes.slice().sort());
      expect(s1.planets.length).toBe(s2.planets.length);
      for (let j = 0; j < s1.planets.length; j++) {
        const p1 = s1.planets[j]!;
        const p2 = s2.planets[j]!;
        expect(p1.id).toBe(p2.id);
        expect(p1.type).toBe(p2.type);
        expect(p1.temperature).toBe(p2.temperature);
        expect(p1.gravity).toBe(p2.gravity);
        expect(p1.naturalResources).toBe(p2.naturalResources);
      }
    }
  });

  it('different seeds produce different galaxies', () => {
    const g1 = generateGalaxy(baseConfig({ seed: 1 }));
    const g2 = generateGalaxy(baseConfig({ seed: 2 }));
    // The sequence of system IDs should differ
    const names1 = g1.systems.map(s => s.name).join(',');
    const names2 = g2.systems.map(s => s.name).join(',');
    expect(names1).not.toBe(names2);
  });
});

// ── system IDs are unique ─────────────────────────────────────────────────────

describe('generateGalaxy – ID uniqueness', () => {
  it('all system IDs are unique within a galaxy', () => {
    const galaxy = generateGalaxy(baseConfig({ size: 'large', seed: 8 }));
    const ids = galaxy.systems.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── spiral galaxy metadata ───────────────────────────────────────────────────

describe('generateGalaxy – spiral shape metadata', () => {
  it('spiral galaxies include shapeMetadata with valid arm parameters', () => {
    const galaxy = generateGalaxy(baseConfig({ shape: 'spiral', seed: 42 }));
    expect(galaxy.shapeMetadata).toBeDefined();
    expect(galaxy.shapeMetadata!.shape).toBe('spiral');
    if (galaxy.shapeMetadata!.shape === 'spiral') {
      expect(galaxy.shapeMetadata!.armCount).toBeGreaterThanOrEqual(4);
      expect(galaxy.shapeMetadata!.armCount).toBeLessThanOrEqual(8);
      expect(galaxy.shapeMetadata!.armAngles).toHaveLength(galaxy.shapeMetadata!.armCount);
      expect(galaxy.shapeMetadata!.spiralTightness).toBeGreaterThan(0);
      expect(galaxy.shapeMetadata!.spiralA).toBeGreaterThan(0);
    }
  });

  it('spiral metadata is deterministic for the same seed', () => {
    const g1 = generateGalaxy(baseConfig({ shape: 'spiral', seed: 99 }));
    const g2 = generateGalaxy(baseConfig({ shape: 'spiral', seed: 99 }));
    expect(g1.shapeMetadata).toEqual(g2.shapeMetadata);
  });

  it('non-spiral shapes have appropriate metadata', () => {
    const elliptical = generateGalaxy(baseConfig({ shape: 'elliptical' }));
    expect(elliptical.shapeMetadata?.shape).toBe('elliptical');

    const ring = generateGalaxy(baseConfig({ shape: 'ring', seed: 7 }));
    expect(ring.shapeMetadata?.shape).toBe('ring');

    const irregular = generateGalaxy(baseConfig({ shape: 'irregular', seed: 3 }));
    expect(irregular.shapeMetadata?.shape).toBe('irregular');
  });

  it('spiral stars are denser near centre than outer galaxy', () => {
    const galaxy = generateGalaxy(baseConfig({ shape: 'spiral', size: 'large', seed: 42 }));
    const cx = galaxy.width / 2;
    const cy = galaxy.height / 2;
    const maxR = Math.min(galaxy.width, galaxy.height) / 2;

    const innerCount = galaxy.systems.filter(s => {
      const dx = s.position.x - cx;
      const dy = s.position.y - cy;
      return Math.sqrt(dx * dx + dy * dy) < maxR * 0.25;
    }).length;

    // Inner 25% radius = ~6.25% of area — should have more than that proportion
    const innerFraction = innerCount / galaxy.systems.length;
    expect(innerFraction).toBeGreaterThan(0.08);
  });
});
