import { describe, it, expect } from 'vitest';
import {
  createExplorationOrder,
  processExplorationTick,
  discoverAnomaliesInSystem,
  calculateRewards,
  calculateInvestigationTicks,
  countFleetSensors,
} from '../engine/exploration.js';
import type { Anomaly, ExplorationOrder } from '../types/anomaly.js';
import type { Empire, Species } from '../types/species.js';
import type { Fleet, Ship, ShipDesign, ShipComponent } from '../types/ships.js';
import type { Galaxy, StarSystem } from '../types/galaxy.js';
import type { EmpireResources } from '../types/resources.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSpecies(overrides: Partial<Species['traits']> = {}): Species {
  return {
    id: 'test_species',
    name: 'Nexari',
    description: '',
    portrait: '',
    isPrebuilt: true,
    specialAbilities: [],
    environmentPreference: {
      idealTemperature: 293,
      temperatureTolerance: 50,
      idealGravity: 1.0,
      gravityTolerance: 0.5,
      preferredAtmospheres: ['oxygen_nitrogen'],
    },
    traits: {
      construction: 5,
      reproduction: 5,
      research: 5,
      espionage: 5,
      economy: 5,
      combat: 5,
      diplomacy: 5,
      ...overrides,
    },
  };
}

function makeEmpire(id = 'empire1', speciesOverrides?: Partial<Species['traits']>, speciesName?: string): Empire {
  const species = makeSpecies(speciesOverrides);
  if (speciesName) species.name = speciesName;
  return {
    id,
    name: 'Test Empire',
    species,
    color: '#ff0000',
    credits: 1000,
    researchPoints: 500,
    knownSystems: ['sys1', 'sys2'],
    diplomacy: [],
    technologies: [],
    currentAge: 'nano_atomic',
    isAI: false,
    government: 'democracy',
  };
}

function makeAnomaly(overrides: Partial<Anomaly> = {}): Anomaly {
  return {
    id: 'anomaly1',
    type: 'mineral_deposit',
    name: 'Rich Mineral Deposit at Alpha',
    description: 'A dense asteroid cluster rich in heavy elements.',
    systemId: 'sys1',
    discovered: true,
    investigated: false,
    ...overrides,
  };
}

function makeFleet(overrides: Partial<Fleet> = {}): Fleet {
  return {
    id: 'fleet1',
    name: 'Scout Fleet Alpha',
    ships: ['ship1'],
    empireId: 'empire1',
    position: { systemId: 'sys1' },
    destination: null,
    waypoints: [],
    stance: 'defensive',
    ...overrides,
  };
}

function makeShip(overrides: Partial<Ship> = {}): Ship {
  return {
    id: 'ship1',
    designId: 'design1',
    name: 'Scout Alpha',
    hullPoints: 100,
    maxHullPoints: 100,
    systemDamage: { engines: 0, weapons: 0, shields: 0, sensors: 0, warpDrive: 0 },
    position: { systemId: 'sys1' },
    fleetId: 'fleet1',
    ...overrides,
  };
}

function makeSystem(id = 'sys1'): StarSystem {
  return {
    id,
    name: 'Alpha System',
    position: { x: 0, y: 0 },
    starType: 'yellow',
    planets: [],
    wormholes: [],
    ownerId: null,
    discovered: {},
  };
}

function makeGalaxy(
  systems: StarSystem[] = [makeSystem()],
  anomalies: Anomaly[] = [makeAnomaly()],
): Galaxy {
  return {
    id: 'galaxy1',
    systems,
    anomalies,
    minorSpecies: [],
    width: 1000,
    height: 1000,
    seed: 42,
  };
}

function makeResources(overrides: Partial<EmpireResources> = {}): EmpireResources {
  return {
    credits: 1000,
    minerals: 500,
    rareElements: 100,
    energy: 200,
    organics: 150,
    exoticMaterials: 50,
    faith: 0,
    researchPoints: 300,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: createExplorationOrder
// ---------------------------------------------------------------------------

describe('createExplorationOrder', () => {
  it('creates a valid order when fleet is in the anomaly system', () => {
    const galaxy = makeGalaxy();
    const fleet = makeFleet();
    const empire = makeEmpire();
    const ship = makeShip();

    const order = createExplorationOrder(
      'anomaly1', 'fleet1', galaxy, [fleet], [ship],
      undefined, undefined, [empire], [],
    );

    expect(order).not.toBeNull();
    expect(order!.anomalyId).toBe('anomaly1');
    expect(order!.fleetId).toBe('fleet1');
    expect(order!.empireId).toBe('empire1');
    expect(order!.systemId).toBe('sys1');
    expect(order!.ticksCompleted).toBe(0);
    expect(order!.totalTicks).toBeGreaterThan(0);
  });

  it('rejects if anomaly does not exist', () => {
    const galaxy = makeGalaxy();
    const fleet = makeFleet();
    const empire = makeEmpire();

    const order = createExplorationOrder(
      'nonexistent', 'fleet1', galaxy, [fleet], [],
      undefined, undefined, [empire], [],
    );

    expect(order).toBeNull();
  });

  it('rejects if anomaly is already investigated', () => {
    const anomaly = makeAnomaly({ investigated: true });
    const galaxy = makeGalaxy([makeSystem()], [anomaly]);
    const fleet = makeFleet();
    const empire = makeEmpire();

    const order = createExplorationOrder(
      'anomaly1', 'fleet1', galaxy, [fleet], [],
      undefined, undefined, [empire], [],
    );

    expect(order).toBeNull();
  });

  it('rejects if anomaly is already being investigated', () => {
    const galaxy = makeGalaxy();
    const fleet = makeFleet();
    const empire = makeEmpire();
    const existingOrder: ExplorationOrder = {
      id: 'existing', anomalyId: 'anomaly1', fleetId: 'other_fleet',
      empireId: 'empire2', systemId: 'sys1', totalTicks: 20, ticksCompleted: 5,
    };

    const order = createExplorationOrder(
      'anomaly1', 'fleet1', galaxy, [fleet], [],
      undefined, undefined, [empire], [existingOrder],
    );

    expect(order).toBeNull();
  });

  it('rejects if fleet is in a different system', () => {
    const galaxy = makeGalaxy();
    const fleet = makeFleet({ position: { systemId: 'sys_other' } });
    const empire = makeEmpire();

    const order = createExplorationOrder(
      'anomaly1', 'fleet1', galaxy, [fleet], [],
      undefined, undefined, [empire], [],
    );

    expect(order).toBeNull();
  });

  it('rejects if fleet does not exist', () => {
    const galaxy = makeGalaxy();
    const empire = makeEmpire();

    const order = createExplorationOrder(
      'anomaly1', 'nonexistent_fleet', galaxy, [], [],
      undefined, undefined, [empire], [],
    );

    expect(order).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: processExplorationTick
// ---------------------------------------------------------------------------

describe('processExplorationTick', () => {
  it('advances tick counter on active orders', () => {
    const order: ExplorationOrder = {
      id: 'order1', anomalyId: 'anomaly1', fleetId: 'fleet1',
      empireId: 'empire1', systemId: 'sys1', totalTicks: 15, ticksCompleted: 3,
    };
    const galaxy = makeGalaxy();
    const fleet = makeFleet();
    const empire = makeEmpire();
    const resources = new Map([['empire1', makeResources()]]);

    const result = processExplorationTick(
      [order], galaxy, [fleet], [empire], resources, 100,
    );

    expect(result.orders.length).toBe(1);
    expect(result.orders[0].ticksCompleted).toBe(4);
    expect(result.events.length).toBe(0);
  });

  it('completes investigation and grants rewards', () => {
    const order: ExplorationOrder = {
      id: 'order1', anomalyId: 'anomaly1', fleetId: 'fleet1',
      empireId: 'empire1', systemId: 'sys1', totalTicks: 15, ticksCompleted: 14,
    };
    const galaxy = makeGalaxy();
    const fleet = makeFleet();
    const empire = makeEmpire();
    const initialResources = makeResources({ minerals: 100, rareElements: 10 });
    const resources = new Map([['empire1', initialResources]]);

    const result = processExplorationTick(
      [order], galaxy, [fleet], [empire], resources, 100,
    );

    // Order should be removed (completed)
    expect(result.orders.length).toBe(0);

    // Should emit an AnomalyInvestigated event
    expect(result.events.length).toBe(1);
    expect(result.events[0].type).toBe('AnomalyInvestigated');
    expect(result.events[0].empireId).toBe('empire1');

    // Anomaly should be marked as investigated
    const updatedAnomaly = result.anomalies.find(a => a.id === 'anomaly1');
    expect(updatedAnomaly?.investigated).toBe(true);
    expect(updatedAnomaly?.investigatedBy).toBe('empire1');

    // Resources should have increased (mineral_deposit rewards minerals + rareElements)
    const updatedResources = result.empireResourcesMap.get('empire1')!;
    expect(updatedResources.minerals).toBeGreaterThan(100);
    expect(updatedResources.rareElements).toBeGreaterThan(10);
  });

  it('cancels orders when fleet moves away', () => {
    const order: ExplorationOrder = {
      id: 'order1', anomalyId: 'anomaly1', fleetId: 'fleet1',
      empireId: 'empire1', systemId: 'sys1', totalTicks: 15, ticksCompleted: 10,
    };
    const galaxy = makeGalaxy();
    // Fleet has moved to a different system
    const fleet = makeFleet({ position: { systemId: 'sys_other' } });
    const empire = makeEmpire();
    const resources = new Map([['empire1', makeResources()]]);

    const result = processExplorationTick(
      [order], galaxy, [fleet], [empire], resources, 100,
    );

    // Order should be cancelled
    expect(result.orders.length).toBe(0);
    // No events (cancelled, not completed)
    expect(result.events.length).toBe(0);
    // Anomaly should NOT be investigated
    const anomaly = result.anomalies.find(a => a.id === 'anomaly1');
    expect(anomaly?.investigated).toBe(false);
  });

  it('cancels orders when fleet is destroyed', () => {
    const order: ExplorationOrder = {
      id: 'order1', anomalyId: 'anomaly1', fleetId: 'fleet1',
      empireId: 'empire1', systemId: 'sys1', totalTicks: 15, ticksCompleted: 10,
    };
    const galaxy = makeGalaxy();
    const empire = makeEmpire();
    const resources = new Map([['empire1', makeResources()]]);

    // No fleets at all — fleet was destroyed
    const result = processExplorationTick(
      [order], galaxy, [], [empire], resources, 100,
    );

    expect(result.orders.length).toBe(0);
    expect(result.events.length).toBe(0);
  });

  it('handles multiple concurrent orders', () => {
    const anomaly2 = makeAnomaly({ id: 'anomaly2', systemId: 'sys2', type: 'debris_field' });
    const galaxy = makeGalaxy(
      [makeSystem('sys1'), makeSystem('sys2')],
      [makeAnomaly(), anomaly2],
    );

    const order1: ExplorationOrder = {
      id: 'o1', anomalyId: 'anomaly1', fleetId: 'fleet1',
      empireId: 'empire1', systemId: 'sys1', totalTicks: 10, ticksCompleted: 9,
    };
    const order2: ExplorationOrder = {
      id: 'o2', anomalyId: 'anomaly2', fleetId: 'fleet2',
      empireId: 'empire1', systemId: 'sys2', totalTicks: 20, ticksCompleted: 5,
    };

    const fleet1 = makeFleet();
    const fleet2 = makeFleet({ id: 'fleet2', position: { systemId: 'sys2' } });
    const empire = makeEmpire();
    const resources = new Map([['empire1', makeResources()]]);

    const result = processExplorationTick(
      [order1, order2], galaxy, [fleet1, fleet2], [empire], resources, 100,
    );

    // Order 1 completes, order 2 continues
    expect(result.orders.length).toBe(1);
    expect(result.orders[0].anomalyId).toBe('anomaly2');
    expect(result.orders[0].ticksCompleted).toBe(6);
    expect(result.events.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: discoverAnomaliesInSystem
// ---------------------------------------------------------------------------

describe('discoverAnomaliesInSystem', () => {
  it('marks undiscovered anomalies in the system as discovered', () => {
    const anomalies: Anomaly[] = [
      makeAnomaly({ id: 'a1', systemId: 'sys1', discovered: false }),
      makeAnomaly({ id: 'a2', systemId: 'sys2', discovered: false }),
    ];

    const result = discoverAnomaliesInSystem('sys1', 'empire1', anomalies);

    expect(result.newlyDiscovered.length).toBe(1);
    expect(result.newlyDiscovered[0].id).toBe('a1');

    const a1 = result.anomalies.find(a => a.id === 'a1');
    expect(a1?.discovered).toBe(true);

    // Other system's anomaly should remain undiscovered
    const a2 = result.anomalies.find(a => a.id === 'a2');
    expect(a2?.discovered).toBe(false);
  });

  it('does not re-discover already discovered anomalies', () => {
    const anomalies: Anomaly[] = [
      makeAnomaly({ id: 'a1', systemId: 'sys1', discovered: true }),
    ];

    const result = discoverAnomaliesInSystem('sys1', 'empire1', anomalies);

    expect(result.newlyDiscovered.length).toBe(0);
  });

  it('handles systems with no anomalies', () => {
    const result = discoverAnomaliesInSystem('sys_empty', 'empire1', []);
    expect(result.newlyDiscovered.length).toBe(0);
    expect(result.anomalies.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: calculateRewards
// ---------------------------------------------------------------------------

describe('calculateRewards', () => {
  it('returns base rewards for a species with no affinity', () => {
    const anomaly = makeAnomaly({ type: 'mineral_deposit' });
    const empire = makeEmpire('e1', {}, 'UnknownSpecies');

    const rewards = calculateRewards(anomaly, empire);

    expect(rewards.minerals).toBe(600);
    expect(rewards.rareElements).toBe(200);
    expect(rewards.credits).toBe(150);
  });

  it('applies species affinity multiplier', () => {
    // Khazari have 1.5x affinity for mineral_deposit
    const anomaly = makeAnomaly({ type: 'mineral_deposit' });
    const empire = makeEmpire('e1', {}, 'Khazari');

    const rewards = calculateRewards(anomaly, empire);

    expect(rewards.minerals).toBe(900);  // 600 * 1.5
    expect(rewards.rareElements).toBe(300);  // 200 * 1.5
    expect(rewards.credits).toBe(225);  // 150 * 1.5 = 225
  });

  it('returns a lore fragment', () => {
    const anomaly = makeAnomaly({ type: 'ancient_beacon' });
    const empire = makeEmpire();

    const rewards = calculateRewards(anomaly, empire);

    expect(rewards.loreFragment).toBeDefined();
    expect(rewards.loreFragment!.length).toBeGreaterThan(0);
  });

  it('handles null empire gracefully', () => {
    const anomaly = makeAnomaly({ type: 'debris_field' });
    const rewards = calculateRewards(anomaly, null);

    expect(rewards.minerals).toBe(200);
    expect(rewards.credits).toBe(100);
  });

  it('handles unknown anomaly type gracefully', () => {
    const anomaly = makeAnomaly({ type: 'unknown_type' as Anomaly['type'] });
    const rewards = calculateRewards(anomaly, null);

    expect(rewards.loreFragment).toBe('The anomaly yields no useful data.');
  });
});

// ---------------------------------------------------------------------------
// Tests: calculateInvestigationTicks
// ---------------------------------------------------------------------------

describe('calculateInvestigationTicks', () => {
  it('uses base ticks from the reward template', () => {
    // mineral_deposit has baseTicks: 15
    const anomaly = makeAnomaly({ type: 'mineral_deposit' });
    const empire = makeEmpire('e1', { research: 1 }); // Min research = no bonus
    const fleet = makeFleet();
    const ship = makeShip();

    const ticks = calculateInvestigationTicks(anomaly, empire, fleet, [ship]);

    // research trait 1 = 0% bonus, no sensors = 0% bonus → 15 ticks
    expect(ticks).toBe(15);
  });

  it('reduces ticks with high research trait', () => {
    // research 10 = 30% reduction → 15 * 0.7 = 10.5 → 11
    const anomaly = makeAnomaly({ type: 'mineral_deposit' });
    const empire = makeEmpire('e1', { research: 10 });
    const fleet = makeFleet();
    const ship = makeShip();

    const ticks = calculateInvestigationTicks(anomaly, empire, fleet, [ship]);

    expect(ticks).toBe(11); // 15 * 0.7 rounded
  });

  it('reduces ticks with sensor components', () => {
    const anomaly = makeAnomaly({ type: 'mineral_deposit' });
    const empire = makeEmpire('e1', { research: 1 });
    const fleet = makeFleet({ ships: ['ship1'] });
    const ship = makeShip({ designId: 'design1' });

    const designs = new Map<string, ShipDesign>([
      ['design1', {
        id: 'design1', name: 'Scout', hull: 'scout',
        components: [{ slotId: 's1', componentId: 'sensor1' }],
        totalCost: 100, empireId: 'empire1',
      }],
    ]);
    const components: ShipComponent[] = [
      { id: 'sensor1', name: 'Basic Sensor', type: 'sensor', stats: {}, cost: 10, requiredTech: null },
    ];

    const ticks = calculateInvestigationTicks(anomaly, empire, fleet, [ship], designs, components);

    // 1 sensor = 5% reduction → 15 * 0.95 = 14.25 → 14
    expect(ticks).toBe(14);
  });

  it('never goes below minimum ticks', () => {
    // Stack maximum bonuses: research 10 + 10 sensors = 30% + 50% = 70% reduction (capped at 70%)
    const anomaly = makeAnomaly({ type: 'debris_field' }); // baseTicks: 12
    const empire = makeEmpire('e1', { research: 10 });

    const shipIds = Array.from({ length: 10 }, (_, i) => `ship${i}`);
    const fleet = makeFleet({ ships: shipIds });
    const ships: Ship[] = shipIds.map(id => makeShip({ id, designId: 'design1', fleetId: 'fleet1' }));

    const sensorSlots = shipIds.map((_, i) => ({ slotId: `s${i}`, componentId: 'sensor1' }));
    const designs = new Map<string, ShipDesign>([
      ['design1', {
        id: 'design1', name: 'Sensor Ship', hull: 'scout',
        components: [{ slotId: 's0', componentId: 'sensor1' }],
        totalCost: 100, empireId: 'empire1',
      }],
    ]);
    const components: ShipComponent[] = [
      { id: 'sensor1', name: 'Sensor', type: 'sensor', stats: {}, cost: 10, requiredTech: null },
    ];

    const ticks = calculateInvestigationTicks(anomaly, empire, fleet, ships, designs, components);

    // 12 * 0.3 = 3.6 → 4, but min is 5
    expect(ticks).toBeGreaterThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// Tests: countFleetSensors
// ---------------------------------------------------------------------------

describe('countFleetSensors', () => {
  it('counts sensor and advanced_sensors components', () => {
    const fleet = makeFleet({ ships: ['ship1', 'ship2'] });
    const ships: Ship[] = [
      makeShip({ id: 'ship1', designId: 'd1' }),
      makeShip({ id: 'ship2', designId: 'd2' }),
    ];

    const designs = new Map<string, ShipDesign>([
      ['d1', {
        id: 'd1', name: 'Scout', hull: 'scout',
        components: [
          { slotId: 's1', componentId: 'basic_sensor' },
          { slotId: 's2', componentId: 'beam_weapon' },
        ],
        totalCost: 100, empireId: 'empire1',
      }],
      ['d2', {
        id: 'd2', name: 'Recon', hull: 'scout',
        components: [
          { slotId: 's1', componentId: 'adv_sensor' },
          { slotId: 's2', componentId: 'adv_sensor' },
        ],
        totalCost: 200, empireId: 'empire1',
      }],
    ]);
    const components: ShipComponent[] = [
      { id: 'basic_sensor', name: 'Sensor', type: 'sensor', stats: {}, cost: 10, requiredTech: null },
      { id: 'adv_sensor', name: 'Advanced', type: 'advanced_sensors', stats: {}, cost: 20, requiredTech: null },
      { id: 'beam_weapon', name: 'Beam', type: 'weapon_beam', stats: {}, cost: 30, requiredTech: null },
    ];

    const count = countFleetSensors(fleet, ships, designs, components);
    expect(count).toBe(3); // 1 basic + 2 advanced
  });

  it('returns 0 when no designs/components provided', () => {
    const fleet = makeFleet();
    const ships = [makeShip()];

    const count = countFleetSensors(fleet, ships);
    expect(count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: AI exploration evaluation (imported from ai.ts)
// ---------------------------------------------------------------------------

describe('AI exploration evaluation', () => {
  // Import lazily to avoid circular dependency issues in tests
  it('generates investigate_anomaly decisions for idle fleets at anomaly sites', async () => {
    const { evaluateExplorationActions } = await import('../engine/ai.js');

    const empire = makeEmpire('empire1', {}, 'Nexari');
    const galaxy = makeGalaxy(
      [makeSystem('sys1')],
      [makeAnomaly({ id: 'a1', systemId: 'sys1', discovered: true })],
    );
    const fleet = makeFleet({ destination: null });

    const decisions = evaluateExplorationActions(empire, galaxy, [fleet], []);

    expect(decisions.length).toBe(1);
    expect(decisions[0].type).toBe('investigate_anomaly');
    expect(decisions[0].params).toEqual({ fleetId: 'fleet1', anomalyId: 'a1' });
    expect(decisions[0].priority).toBeGreaterThan(0);
  });

  it('skips anomalies that are already investigated', async () => {
    const { evaluateExplorationActions } = await import('../engine/ai.js');

    const empire = makeEmpire();
    const galaxy = makeGalaxy(
      [makeSystem()],
      [makeAnomaly({ investigated: true })],
    );
    const fleet = makeFleet();

    const decisions = evaluateExplorationActions(empire, galaxy, [fleet], []);
    expect(decisions.length).toBe(0);
  });

  it('skips anomalies already being investigated', async () => {
    const { evaluateExplorationActions } = await import('../engine/ai.js');

    const empire = makeEmpire();
    const galaxy = makeGalaxy();
    const fleet = makeFleet();
    const existingOrder: ExplorationOrder = {
      id: 'o1', anomalyId: 'anomaly1', fleetId: 'fleet_other',
      empireId: 'empire2', systemId: 'sys1', totalTicks: 20, ticksCompleted: 5,
    };

    const decisions = evaluateExplorationActions(empire, galaxy, [fleet], [existingOrder]);
    expect(decisions.length).toBe(0);
  });

  it('skips systems the empire has not discovered', async () => {
    const { evaluateExplorationActions } = await import('../engine/ai.js');

    const empire = makeEmpire();
    empire.knownSystems = ['sys_other']; // Does NOT include sys1
    const galaxy = makeGalaxy();
    const fleet = makeFleet();

    const decisions = evaluateExplorationActions(empire, galaxy, [fleet], []);
    expect(decisions.length).toBe(0);
  });

  it('skips fleets that have a destination (not idle)', async () => {
    const { evaluateExplorationActions } = await import('../engine/ai.js');

    const empire = makeEmpire();
    const galaxy = makeGalaxy();
    const fleet = makeFleet({ destination: 'sys2' });

    const decisions = evaluateExplorationActions(empire, galaxy, [fleet], []);
    expect(decisions.length).toBe(0);
  });
});
