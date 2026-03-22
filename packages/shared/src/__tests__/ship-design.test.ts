import { describe, it, expect } from 'vitest';

import {
  HULL_TEMPLATES,
  HULL_TEMPLATE_BY_CLASS,
  SHIP_COMPONENTS,
  SHIP_COMPONENT_BY_ID,
  STARTING_COMPONENTS,
} from '../../data/ships/index.js';
import {
  HullTemplateSchema,
  ShipComponentSchema,
  assertSlotCountConsistent,
} from '../validation/ships.js';
import {
  validateDesign,
  calculateDesignStats,
  createShipFromDesign,
  getAvailableComponents,
  autoEquipDesign,
} from '../engine/ship-design.js';
import type { ShipDesign, HullTemplate, ShipComponent } from '../types/ships.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

function getHull(cls: string): HullTemplate {
  const h = HULL_TEMPLATE_BY_CLASS[cls];
  if (!h) throw new Error(`Hull class "${cls}" not found in data.`);
  return h;
}

function getComponent(id: string): ShipComponent {
  const c = SHIP_COMPONENT_BY_ID[id];
  if (!c) throw new Error(`Component "${id}" not found in data.`);
  return c;
}

/** Build a minimal valid design for a scout using starting components. */
function makeValidScoutDesign(): { design: ShipDesign; hull: HullTemplate; usedComponents: ShipComponent[] } {
  const hull = getHull('scout');
  const engine = getComponent('ion_engine');
  const scanner = getComponent('short_range_scanner');
  const laser = getComponent('pulse_laser');

  const design: ShipDesign = {
    id: 'test-design-1',
    name: 'Test Scout',
    hull: 'scout',
    components: [
      { slotId: 'scout_fore_1', componentId: laser.id },
      { slotId: 'scout_turret_1', componentId: scanner.id },
      { slotId: 'scout_aft_1', componentId: engine.id },
    ],
    totalCost: 0,
    empireId: 'empire-1',
  };

  return { design, hull, usedComponents: [engine, scanner, laser] };
}

// ---------------------------------------------------------------------------
// Hull templates: data and schema
// ---------------------------------------------------------------------------

describe('Hull templates data', () => {
  it('exports exactly 7 hull templates', () => {
    expect(HULL_TEMPLATES).toHaveLength(7);
  });

  it('contains all expected hull classes', () => {
    const classes = HULL_TEMPLATES.map((h) => h.class).sort();
    expect(classes).toEqual(['battleship', 'carrier', 'coloniser', 'cruiser', 'destroyer', 'scout', 'transport']);
  });

  it('has unique classes', () => {
    const classes = HULL_TEMPLATES.map((h) => h.class);
    expect(new Set(classes).size).toBe(classes.length);
  });

  it('HULL_TEMPLATE_BY_CLASS contains all hulls', () => {
    for (const hull of HULL_TEMPLATES) {
      expect(HULL_TEMPLATE_BY_CLASS[hull.class]).toBe(hull);
    }
  });

  describe.each(HULL_TEMPLATES.map((h) => [h.class, h] as [string, HullTemplate]))(
    'hull "%s"',
    (_cls, hull) => {
      it('passes Zod schema validation', () => {
        const result = HullTemplateSchema.safeParse(hull);
        if (!result.success) {
          throw new Error(
            `Validation failed for hull "${hull.class}":\n${result.error.issues
              .map((i) => `  ${i.path.join('.')}: ${i.message}`)
              .join('\n')}`,
          );
        }
        expect(result.success).toBe(true);
      });

      it('has slot count consistent with maxSlots', () => {
        expect(() => assertSlotCountConsistent(hull)).not.toThrow();
      });

      it('has positive base stats', () => {
        expect(hull.baseHullPoints).toBeGreaterThan(0);
        expect(hull.baseCost).toBeGreaterThan(0);
        expect(hull.baseSpeed).toBeGreaterThan(0);
      });

      it('has at least one slot', () => {
        expect(hull.slotLayout.length).toBeGreaterThan(0);
      });

      it('has a non-empty requiredAge', () => {
        expect(hull.requiredAge.trim().length).toBeGreaterThan(0);
      });

      it('has no duplicate slot IDs', () => {
        const ids = hull.slotLayout.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('every slot has at least one allowed type', () => {
        for (const slot of hull.slotLayout) {
          expect(slot.allowedTypes.length).toBeGreaterThan(0);
        }
      });
    },
  );
});

// ---------------------------------------------------------------------------
// Components: data and schema
// ---------------------------------------------------------------------------

describe('Ship components data', () => {
  it('exports at least 20 components', () => {
    expect(SHIP_COMPONENTS.length).toBeGreaterThanOrEqual(20);
  });

  it('STARTING_COMPONENTS have requiredTech === null', () => {
    for (const c of STARTING_COMPONENTS) {
      expect(c.requiredTech).toBeNull();
    }
  });

  it('has at least one starting component', () => {
    expect(STARTING_COMPONENTS.length).toBeGreaterThan(0);
  });

  it('has unique component IDs', () => {
    const ids = SHIP_COMPONENTS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('SHIP_COMPONENT_BY_ID contains all components', () => {
    for (const comp of SHIP_COMPONENTS) {
      expect(SHIP_COMPONENT_BY_ID[comp.id]).toBe(comp);
    }
  });

  describe.each(SHIP_COMPONENTS.map((c) => [c.id, c] as [string, ShipComponent]))(
    'component "%s"',
    (id, comp) => {
      it('passes Zod schema validation', () => {
        const result = ShipComponentSchema.safeParse(comp);
        if (!result.success) {
          throw new Error(
            `Validation failed for component "${id}":\n${result.error.issues
              .map((i) => `  ${i.path.join('.')}: ${i.message}`)
              .join('\n')}`,
          );
        }
        expect(result.success).toBe(true);
      });

      it('has positive cost', () => {
        expect(comp.cost).toBeGreaterThan(0);
      });

      it('has at least one stat', () => {
        expect(Object.keys(comp.stats).length).toBeGreaterThan(0);
      });
    },
  );
});

// ---------------------------------------------------------------------------
// validateDesign
// ---------------------------------------------------------------------------

describe('validateDesign', () => {
  it('returns valid for a well-formed scout design', () => {
    const { design, hull, usedComponents } = makeValidScoutDesign();
    const result = validateDesign(design, hull, usedComponents);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when a component type is not allowed in the slot', () => {
    const hull = getHull('scout');
    // Ion engine in a fore (weapon/sensor-only) slot
    const engine = getComponent('ion_engine');
    const scanner = getComponent('short_range_scanner');

    const design: ShipDesign = {
      id: 'bad-design-1',
      name: 'Bad Scout',
      hull: 'scout',
      components: [
        { slotId: 'scout_fore_1', componentId: engine.id },   // engine not allowed in fore slot
        { slotId: 'scout_turret_1', componentId: scanner.id },
        { slotId: 'scout_aft_1', componentId: engine.id },
      ],
      totalCost: 0,
      empireId: 'empire-1',
    };

    const result = validateDesign(design, hull, [engine, scanner]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('not allowed in slot'))).toBe(true);
  });

  it('fails when a slot is assigned twice', () => {
    const hull = getHull('scout');
    const laser = getComponent('pulse_laser');
    const engine = getComponent('ion_engine');

    const design: ShipDesign = {
      id: 'bad-design-2',
      name: 'Duplicate Slot Scout',
      hull: 'scout',
      components: [
        { slotId: 'scout_fore_1', componentId: laser.id },
        { slotId: 'scout_fore_1', componentId: laser.id }, // duplicate
        { slotId: 'scout_aft_1', componentId: engine.id },
      ],
      totalCost: 0,
      empireId: 'empire-1',
    };

    const result = validateDesign(design, hull, [laser, engine]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('more than once'))).toBe(true);
  });

  it('fails when no engine or warp drive is present', () => {
    const hull = getHull('scout');
    const laser = getComponent('pulse_laser');
    const scanner = getComponent('short_range_scanner');

    const design: ShipDesign = {
      id: 'no-engine-design',
      name: 'Engineless Scout',
      hull: 'scout',
      components: [
        { slotId: 'scout_fore_1', componentId: laser.id },
        { slotId: 'scout_turret_1', componentId: scanner.id },
        // No aft engine
      ],
      totalCost: 0,
      empireId: 'empire-1',
    };

    const result = validateDesign(design, hull, [laser, scanner]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes('engine'))).toBe(true);
  });

  it('fails when a slot ID does not exist on the hull', () => {
    const hull = getHull('scout');
    const engine = getComponent('ion_engine');

    const design: ShipDesign = {
      id: 'bad-slot-design',
      name: 'Bad Slot Scout',
      hull: 'scout',
      components: [
        { slotId: 'nonexistent_slot', componentId: engine.id },
        { slotId: 'scout_aft_1', componentId: engine.id },
      ],
      totalCost: 0,
      empireId: 'empire-1',
    };

    const result = validateDesign(design, hull, [engine]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('does not exist'))).toBe(true);
  });

  it('fails when a component ID cannot be resolved', () => {
    const hull = getHull('scout');
    const engine = getComponent('ion_engine');

    const design: ShipDesign = {
      id: 'missing-comp-design',
      name: 'Missing Component Scout',
      hull: 'scout',
      components: [
        { slotId: 'scout_fore_1', componentId: 'nonexistent_component' },
        { slotId: 'scout_aft_1', componentId: engine.id },
      ],
      totalCost: 0,
      empireId: 'empire-1',
    };

    const result = validateDesign(design, hull, [engine]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('not found'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// calculateDesignStats
// ---------------------------------------------------------------------------

describe('calculateDesignStats', () => {
  it('sums damage across weapon components', () => {
    const { design, hull, usedComponents } = makeValidScoutDesign();
    const laser = getComponent('pulse_laser');
    const stats = calculateDesignStats(design, hull, usedComponents);

    // Only one pulse laser is in the design
    expect(stats.totalDamage).toBe(laser.stats['damage']);
  });

  it('picks maximum speed across engine components', () => {
    const hull = getHull('scout');
    const engine = getComponent('ion_engine');
    const warpDrive = getComponent('basic_warp_drive');

    const design: ShipDesign = {
      id: 'speed-design',
      name: 'Speed Scout',
      hull: 'scout',
      components: [
        { slotId: 'scout_fore_1', componentId: warpDrive.id },
        { slotId: 'scout_turret_1', componentId: warpDrive.id },
        { slotId: 'scout_aft_1', componentId: engine.id },
      ],
      totalCost: 0,
      empireId: 'empire-1',
    };

    const stats = calculateDesignStats(design, hull, [engine, warpDrive]);
    expect(stats.speed).toBe(engine.stats['speed']); // engine takes priority
  });

  it('sums shield strength across shield components', () => {
    const hull = getHull('destroyer');
    const engine = getComponent('ion_engine');
    const shield = getComponent('deflector_shield');
    const laser = getComponent('pulse_laser');

    const design: ShipDesign = {
      id: 'shield-design',
      name: 'Shield Destroyer',
      hull: 'destroyer',
      components: [
        { slotId: 'destroyer_fore_1', componentId: laser.id },
        { slotId: 'destroyer_fore_2', componentId: laser.id },
        { slotId: 'destroyer_turret_1', componentId: shield.id },
        { slotId: 'destroyer_port_1', componentId: laser.id },
        { slotId: 'destroyer_starboard_1', componentId: engine.id },
      ],
      totalCost: 0,
      empireId: 'empire-1',
    };

    const stats = calculateDesignStats(design, hull, [engine, shield, laser]);
    expect(stats.totalShields).toBe(shield.stats['shieldStrength']);
  });

  it('includes hull base cost plus component costs', () => {
    const { design, hull, usedComponents } = makeValidScoutDesign();
    const stats = calculateDesignStats(design, hull, usedComponents);

    const componentCostSum = usedComponents.reduce((sum, c) => {
      // count how many times each component appears
      const assignmentCount = design.components.filter((a) => a.componentId === c.id).length;
      return sum + c.cost * assignmentCount;
    }, 0);

    expect(stats.cost).toBe(hull.baseCost + componentCostSum);
  });

  it('picks maximum sensorRange across sensor components', () => {
    const { design, hull, usedComponents } = makeValidScoutDesign();
    const scanner = getComponent('short_range_scanner');
    const stats = calculateDesignStats(design, hull, usedComponents);

    expect(stats.sensorRange).toBe(scanner.stats['sensorRange']);
  });
});

// ---------------------------------------------------------------------------
// getAvailableComponents
// ---------------------------------------------------------------------------

describe('getAvailableComponents', () => {
  it('returns only starting components when no techs researched', () => {
    const available = getAvailableComponents(SHIP_COMPONENTS, []);
    const expectedIds = STARTING_COMPONENTS.map((c) => c.id).sort();
    const actualIds = available.map((c) => c.id).sort();
    expect(actualIds).toEqual(expectedIds);
  });

  it('unlocks tech-gated components when the required tech is researched', () => {
    const available = getAvailableComponents(SHIP_COMPONENTS, ['phased_arrays']);
    const ids = available.map((c) => c.id);
    expect(ids).toContain('phased_array');
  });

  it('does not include locked components without the required tech', () => {
    const available = getAvailableComponents(SHIP_COMPONENTS, []);
    const ids = available.map((c) => c.id);
    expect(ids).not.toContain('phased_array');
    expect(ids).not.toContain('plasma_lance');
  });

  it('returns all components when all techs are researched', () => {
    const allTechIds = SHIP_COMPONENTS
      .filter((c) => c.requiredTech !== null)
      .map((c) => c.requiredTech as string);

    const available = getAvailableComponents(SHIP_COMPONENTS, allTechIds);
    expect(available.length).toBe(SHIP_COMPONENTS.length);
  });

  it('does not mutate the original component array', () => {
    const originalLength = SHIP_COMPONENTS.length;
    getAvailableComponents(SHIP_COMPONENTS, ['phased_arrays']);
    expect(SHIP_COMPONENTS.length).toBe(originalLength);
  });
});

// ---------------------------------------------------------------------------
// autoEquipDesign
// ---------------------------------------------------------------------------

describe('autoEquipDesign', () => {
  it('fills all slots when enough starting components are available', () => {
    const hull = getHull('scout');
    const design = autoEquipDesign(hull, STARTING_COMPONENTS);

    // All 3 scout slots should be filled
    expect(design.components.length).toBe(hull.slotLayout.length);
  });

  it('assigns only one component per slot', () => {
    const hull = getHull('scout');
    const design = autoEquipDesign(hull, STARTING_COMPONENTS);

    const slotIds = design.components.map((a) => a.slotId);
    expect(new Set(slotIds).size).toBe(slotIds.length);
  });

  it('assigns only allowed component types to each slot', () => {
    const hull = getHull('destroyer');
    const design = autoEquipDesign(hull, STARTING_COMPONENTS);

    const componentById = new Map(STARTING_COMPONENTS.map((c) => [c.id, c]));
    const slotById = new Map(hull.slotLayout.map((s) => [s.id, s]));

    for (const assignment of design.components) {
      const slot = slotById.get(assignment.slotId)!;
      const component = componentById.get(assignment.componentId)!;
      expect(slot.allowedTypes).toContain(component.type);
    }
  });

  it('produces a design with at least one engine when components are available', () => {
    const hull = getHull('scout');
    const design = autoEquipDesign(hull, STARTING_COMPONENTS);

    const componentById = new Map(STARTING_COMPONENTS.map((c) => [c.id, c]));
    const hasEngine = design.components.some((a) => {
      const c = componentById.get(a.componentId);
      return c?.type === 'engine' || c?.type === 'warp_drive';
    });

    expect(hasEngine).toBe(true);
  });

  it('auto-equips a cruiser with all slots filled using full starting set', () => {
    const hull = getHull('cruiser');
    const design = autoEquipDesign(hull, STARTING_COMPONENTS);

    // Cruiser has 8 slots; all should be assigned (starting components cover all types)
    expect(design.components.length).toBe(hull.slotLayout.length);
  });

  it('prefers high-damage components in weapon slots with advanced tech', () => {
    const hull = getHull('scout');
    // Include both pulse_laser and plasma_lance; fore slot allows weapon_beam
    const plasmaLance = getComponent('plasma_lance');
    const pulseLaser = getComponent('pulse_laser');
    const engine = getComponent('ion_engine');
    const scanner = getComponent('short_range_scanner');

    const components = [pulseLaser, plasmaLance, engine, scanner];
    const design = autoEquipDesign(hull, components);

    const foreAssignment = design.components.find((a) => a.slotId === 'scout_fore_1');
    expect(foreAssignment?.componentId).toBe(plasmaLance.id);
  });

  it('returns a design with the correct hull class', () => {
    const hull = getHull('battleship');
    const design = autoEquipDesign(hull, STARTING_COMPONENTS);
    expect(design.hull).toBe('battleship');
  });
});

// ---------------------------------------------------------------------------
// createShipFromDesign
// ---------------------------------------------------------------------------

describe('createShipFromDesign', () => {
  it('creates a ship with correct hull points from the template', () => {
    const { design, hull } = makeValidScoutDesign();
    const ship = createShipFromDesign(design, hull, 'empire-1', 'system-alpha');

    expect(ship.hullPoints).toBe(hull.baseHullPoints);
    expect(ship.maxHullPoints).toBe(hull.baseHullPoints);
  });

  it('places the ship in the specified system', () => {
    const { design, hull } = makeValidScoutDesign();
    const ship = createShipFromDesign(design, hull, 'empire-1', 'system-beta');

    expect(ship.position.systemId).toBe('system-beta');
  });

  it('creates a ship with no system damage', () => {
    const { design, hull } = makeValidScoutDesign();
    const ship = createShipFromDesign(design, hull, 'empire-1', 'system-alpha');

    expect(ship.systemDamage.engines).toBe(0);
    expect(ship.systemDamage.weapons).toBe(0);
    expect(ship.systemDamage.shields).toBe(0);
    expect(ship.systemDamage.sensors).toBe(0);
    expect(ship.systemDamage.warpDrive).toBe(0);
  });

  it('creates a ship not assigned to any fleet', () => {
    const { design, hull } = makeValidScoutDesign();
    const ship = createShipFromDesign(design, hull, 'empire-1', 'system-alpha');

    expect(ship.fleetId).toBeNull();
  });

  it('creates ships with unique IDs', () => {
    const { design, hull } = makeValidScoutDesign();
    const ship1 = createShipFromDesign(design, hull, 'empire-1', 'system-alpha');
    const ship2 = createShipFromDesign(design, hull, 'empire-1', 'system-alpha');

    expect(ship1.id).not.toBe(ship2.id);
  });

  it('uses the design name as the ship name', () => {
    const { design, hull } = makeValidScoutDesign();
    const ship = createShipFromDesign(design, hull, 'empire-1', 'system-alpha');

    expect(ship.name).toBe(design.name);
  });

  it('references the correct design ID', () => {
    const { design, hull } = makeValidScoutDesign();
    const ship = createShipFromDesign(design, hull, 'empire-1', 'system-alpha');

    expect(ship.designId).toBe(design.id);
  });
});
