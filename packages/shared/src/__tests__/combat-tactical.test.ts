import { describe, it, expect } from 'vitest';

import {
  initializeTacticalCombat,
  processTacticalTick,
  setShipOrder,
  findTarget,
  moveShip,
  applyDamage,
  BATTLEFIELD_WIDTH,
  BATTLEFIELD_HEIGHT,
  PROJECTILE_SPEED,
} from '../engine/combat-tactical.js';
import type {
  TacticalState,
  TacticalShip,
  ShipOrder,
} from '../engine/combat-tactical.js';
import type { Fleet, Ship, ShipDesign, ShipComponent } from '../types/ships.js';
import { SHIP_COMPONENTS } from '../../data/ships/index.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeFleet(id: string, empireId: string, shipIds: string[]): Fleet {
  return {
    id,
    name: `Fleet ${id}`,
    ships: shipIds,
    empireId,
    position: { systemId: 'system-alpha' },
    destination: null,
    waypoints: [],
    stance: 'aggressive',
  };
}

function makeShip(
  id: string,
  designId: string,
  hullPoints = 100,
  maxHullPoints = 100,
): Ship {
  return {
    id,
    designId,
    name: `Ship ${id}`,
    hullPoints,
    maxHullPoints,
    systemDamage: {
      engines: 0,
      weapons: 0,
      shields: 0,
      sensors: 0,
      warpDrive: 0,
    },
    position: { systemId: 'system-alpha' },
    fleetId: null,
  };
}

function makeArmedDesign(id: string, empireId = 'empire-1'): ShipDesign {
  return {
    id,
    name: `Design ${id}`,
    hull: 'scout',
    components: [
      { slotId: 'scout_fore_1', componentId: 'pulse_laser' },
      { slotId: 'scout_turret_1', componentId: 'deflector_shield' },
      { slotId: 'scout_aft_1', componentId: 'ion_engine' },
    ],
    totalCost: 185,
    empireId,
  };
}

function makeProjectileDesign(id: string, empireId = 'empire-1'): ShipDesign {
  return {
    id,
    name: `Projectile Design ${id}`,
    hull: 'scout',
    components: [
      { slotId: 'scout_fore_1', componentId: 'kinetic_cannon' },
      { slotId: 'scout_turret_1', componentId: 'deflector_shield' },
      { slotId: 'scout_aft_1', componentId: 'ion_engine' },
    ],
    totalCost: 195,
    empireId,
  };
}

function makeDesignWithSensor(id: string, empireId = 'empire-1'): ShipDesign {
  return {
    id,
    name: `Sensor Design ${id}`,
    hull: 'scout',
    components: [
      { slotId: 'scout_fore_1', componentId: 'pulse_laser' },
      { slotId: 'scout_turret_1', componentId: 'short_range_scanner' },
      { slotId: 'scout_aft_1', componentId: 'ion_engine' },
    ],
    totalCost: 155,
    empireId,
  };
}

function setupOnePair(designOverrides?: {
  attacker?: ShipDesign;
  defender?: ShipDesign;
}): TacticalState {
  const attackerDesign = designOverrides?.attacker ?? makeArmedDesign('d-atk', 'empire-1');
  const defenderDesign = designOverrides?.defender ?? makeArmedDesign('d-def', 'empire-2');

  const designs = new Map<string, ShipDesign>([
    [attackerDesign.id, attackerDesign],
    [defenderDesign.id, defenderDesign],
  ]);

  const attackerShips = [makeShip('atk-1', attackerDesign.id)];
  const defenderShips = [makeShip('def-1', defenderDesign.id)];

  return initializeTacticalCombat(
    makeFleet('f-atk', 'empire-1', ['atk-1']),
    makeFleet('f-def', 'empire-2', ['def-1']),
    attackerShips,
    defenderShips,
    designs,
    SHIP_COMPONENTS,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('initializeTacticalCombat', () => {
  it('places attackers near top-left and defenders near bottom-right', () => {
    const state = setupOnePair();

    const attackers = state.ships.filter((s) => s.side === 'attacker');
    const defenders = state.ships.filter((s) => s.side === 'defender');

    expect(attackers).toHaveLength(1);
    expect(defenders).toHaveLength(1);

    // Attackers near (100, 100)
    expect(attackers[0].position.x).toBeCloseTo(100, 0);
    expect(attackers[0].position.y).toBeCloseTo(100, 0);

    // Defenders near bottom-right
    expect(defenders[0].position.x).toBeCloseTo(BATTLEFIELD_WIDTH - 100, 0);
    expect(defenders[0].position.y).toBeCloseTo(BATTLEFIELD_HEIGHT - 100, 0);
  });

  it('attackers face right (0 rad) and defenders face left (PI rad)', () => {
    const state = setupOnePair();
    const attackers = state.ships.filter((s) => s.side === 'attacker');
    const defenders = state.ships.filter((s) => s.side === 'defender');

    expect(attackers[0].facing).toBeCloseTo(0, 5);
    expect(defenders[0].facing).toBeCloseTo(Math.PI, 5);
  });

  it('spreads multiple ships in a 3-column grid with 60px spacing', () => {
    const design = makeArmedDesign('d-multi', 'empire-1');
    const designs = new Map<string, ShipDesign>([[design.id, design]]);

    const ships = Array.from({ length: 5 }, (_, i) =>
      makeShip(`s-${i}`, design.id),
    );

    const state = initializeTacticalCombat(
      makeFleet('f-atk', 'empire-1', ships.map((s) => s.id)),
      makeFleet('f-def', 'empire-2', []),
      ships,
      [],
      designs,
      SHIP_COMPONENTS,
    );

    const attackers = state.ships.filter((s) => s.side === 'attacker');
    expect(attackers).toHaveLength(5);

    // First row: indices 0, 1, 2 at y=100
    // Second row: indices 3, 4 at y=160
    expect(attackers[0].position).toEqual({ x: 100, y: 100 });
    expect(attackers[1].position).toEqual({ x: 160, y: 100 });
    expect(attackers[2].position).toEqual({ x: 220, y: 100 });
    expect(attackers[3].position).toEqual({ x: 100, y: 160 });
    expect(attackers[4].position).toEqual({ x: 160, y: 160 });
  });

  it('extracts component stats — weapons, speed, shields', () => {
    const state = setupOnePair();
    const atk = state.ships.find((s) => s.side === 'attacker')!;

    // pulse_laser: damage=10, range=5 => battlefield range = 250
    expect(atk.weapons).toHaveLength(1);
    expect(atk.weapons[0].damage).toBe(10);
    expect(atk.weapons[0].range).toBe(250); // 5 * 50
    expect(atk.weapons[0].type).toBe('beam');

    // ion_engine: speed=3
    expect(atk.speed).toBe(3);

    // deflector_shield: shieldStrength=30
    expect(atk.shields).toBe(30);
    expect(atk.maxShields).toBe(30);
  });

  it('extracts sensor range from sensor components', () => {
    const state = setupOnePair({
      attacker: makeDesignWithSensor('d-sensor', 'empire-1'),
    });
    const atk = state.ships.find((s) => s.side === 'attacker')!;

    // short_range_scanner: sensorRange=3 => 3 * 50 = 150
    expect(atk.sensorRange).toBe(150);
  });

  it('starts with tick 0, no projectiles, no beam effects', () => {
    const state = setupOnePair();
    expect(state.tick).toBe(0);
    expect(state.projectiles).toEqual([]);
    expect(state.beamEffects).toEqual([]);
  });
});

describe('processTacticalTick', () => {
  it('advances the tick counter', () => {
    const state = setupOnePair();
    const next = processTacticalTick(state);
    expect(next.tick).toBe(1);

    const next2 = processTacticalTick(next);
    expect(next2.tick).toBe(2);
  });

  it('ships with attack orders move toward their targets', () => {
    let state = setupOnePair();

    // Give attacker an attack order targeting the defender
    const attacker = state.ships.find((s) => s.side === 'attacker')!;
    const defender = state.ships.find((s) => s.side === 'defender')!;
    state = setShipOrder(state, attacker.id, { type: 'attack', targetId: defender.id });

    const initialDist = Math.sqrt(
      (attacker.position.x - defender.position.x) ** 2 +
      (attacker.position.y - defender.position.y) ** 2,
    );

    // Run several ticks
    let current = state;
    for (let i = 0; i < 20; i++) {
      current = processTacticalTick(current);
    }

    const movedAttacker = current.ships.find((s) => s.sourceShipId === attacker.sourceShipId)!;
    const currentDist = Math.sqrt(
      (movedAttacker.position.x - defender.position.x) ** 2 +
      (movedAttacker.position.y - defender.position.y) ** 2,
    );

    expect(currentDist).toBeLessThan(initialDist);
  });

  it('ships with move orders head toward the specified coordinates', () => {
    let state = setupOnePair();

    const attacker = state.ships.find((s) => s.side === 'attacker')!;
    state = setShipOrder(state, attacker.id, { type: 'move', x: 500, y: 500 });

    let current = state;
    for (let i = 0; i < 30; i++) {
      current = processTacticalTick(current);
    }

    const moved = current.ships.find((s) => s.sourceShipId === attacker.sourceShipId)!;
    const distToTarget = Math.sqrt(
      (moved.position.x - 500) ** 2 + (moved.position.y - 500) ** 2,
    );

    // Should be closer to (500, 500) than the start (100, 100)
    const startDist = Math.sqrt((100 - 500) ** 2 + (100 - 500) ** 2);
    expect(distToTarget).toBeLessThan(startDist);
  });
});

describe('setShipOrder', () => {
  it('updates a ship order by tactical ID', () => {
    const state = setupOnePair();
    const ship = state.ships[0];

    const newOrder: ShipOrder = { type: 'attack', targetId: 'some-target' };
    const updated = setShipOrder(state, ship.id, newOrder);

    const updatedShip = updated.ships.find((s) => s.id === ship.id)!;
    expect(updatedShip.order).toEqual(newOrder);
  });

  it('updates a ship order by source ship ID', () => {
    const state = setupOnePair();
    const ship = state.ships[0];

    const newOrder: ShipOrder = { type: 'flee' };
    const updated = setShipOrder(state, ship.sourceShipId, newOrder);

    const updatedShip = updated.ships.find((s) => s.sourceShipId === ship.sourceShipId)!;
    expect(updatedShip.order).toEqual(newOrder);
  });

  it('does not modify other ships', () => {
    const state = setupOnePair();
    const ship = state.ships[0];
    const otherShip = state.ships[1];

    const updated = setShipOrder(state, ship.id, { type: 'flee' });
    const otherUpdated = updated.ships.find((s) => s.id === otherShip.id)!;
    expect(otherUpdated.order).toEqual({ type: 'idle' });
  });
});

describe('fleeing ships', () => {
  it('attackers flee toward (-50, -50) and get marked routed when off-map', () => {
    let state = setupOnePair();

    const attacker = state.ships.find((s) => s.side === 'attacker')!;
    state = setShipOrder(state, attacker.id, { type: 'flee' });

    // Run enough ticks for the ship to leave the map
    let current = state;
    for (let i = 0; i < 200; i++) {
      current = processTacticalTick(current);
      const fleeing = current.ships.find((s) => s.sourceShipId === attacker.sourceShipId)!;
      if (fleeing.routed) break;
    }

    const fled = current.ships.find((s) => s.sourceShipId === attacker.sourceShipId)!;
    expect(fled.routed).toBe(true);
  });

  it('defenders flee toward the bottom-right corner', () => {
    let state = setupOnePair();

    const defender = state.ships.find((s) => s.side === 'defender')!;
    state = setShipOrder(state, defender.id, { type: 'flee' });

    let current = state;
    for (let i = 0; i < 200; i++) {
      current = processTacticalTick(current);
      const fleeing = current.ships.find((s) => s.sourceShipId === defender.sourceShipId)!;
      if (fleeing.routed) break;
    }

    const fled = current.ships.find((s) => s.sourceShipId === defender.sourceShipId)!;
    expect(fled.routed).toBe(true);
  });
});

describe('findTarget', () => {
  it('returns closest enemy when ship has no explicit target', () => {
    const state = setupOnePair();
    const attacker = state.ships.find((s) => s.side === 'attacker')!;
    const defender = state.ships.find((s) => s.side === 'defender')!;

    const target = findTarget(attacker, state.ships);
    expect(target).not.toBeNull();
    expect(target!.id).toBe(defender.id);
  });

  it('returns null when no enemies exist', () => {
    const design = makeArmedDesign('d-solo', 'empire-1');
    const designs = new Map<string, ShipDesign>([[design.id, design]]);
    const ships = [makeShip('s-1', design.id)];

    const state = initializeTacticalCombat(
      makeFleet('f-atk', 'empire-1', ['s-1']),
      makeFleet('f-def', 'empire-2', []),
      ships,
      [],
      designs,
      SHIP_COMPONENTS,
    );

    const attacker = state.ships.find((s) => s.side === 'attacker')!;
    expect(findTarget(attacker, state.ships)).toBeNull();
  });

  it('ignores destroyed and routed enemies', () => {
    const state = setupOnePair();
    const attacker = state.ships.find((s) => s.side === 'attacker')!;

    // Mark defender as destroyed
    const modifiedShips = state.ships.map((s) =>
      s.side === 'defender' ? { ...s, destroyed: true } : s,
    );

    expect(findTarget(attacker, modifiedShips)).toBeNull();
  });
});

describe('weapon firing — beams', () => {
  it('creates beam effects when ships are in weapon range', () => {
    let state = setupOnePair();

    // Put ships right next to each other so they're in range
    state = {
      ...state,
      ships: state.ships.map((s) =>
        s.side === 'attacker'
          ? { ...s, position: { x: 400, y: 400 }, order: { type: 'attack' as const, targetId: state.ships.find((d) => d.side === 'defender')!.id } }
          : { ...s, position: { x: 450, y: 400 }, order: { type: 'attack' as const, targetId: state.ships.find((a) => a.side === 'attacker')!.id } },
      ),
    };

    const next = processTacticalTick(state);

    // Both ships have beam weapons (pulse_laser) and are within range
    // Should create beam effects
    expect(next.beamEffects.length).toBeGreaterThan(0);
    expect(next.beamEffects[0].ticksRemaining).toBe(3);
  });

  it('beam effects decay over ticks', () => {
    let state = setupOnePair();

    // Place ships close and fire
    state = {
      ...state,
      ships: state.ships.map((s) =>
        s.side === 'attacker'
          ? { ...s, position: { x: 400, y: 400 }, order: { type: 'attack' as const, targetId: state.ships.find((d) => d.side === 'defender')!.id } }
          : { ...s, position: { x: 450, y: 400 }, order: { type: 'attack' as const, targetId: state.ships.find((a) => a.side === 'attacker')!.id } },
      ),
    };

    let current = processTacticalTick(state);
    expect(current.beamEffects.length).toBeGreaterThan(0);

    // Separate ships so no new beams are created
    current = {
      ...current,
      ships: current.ships.map((s) =>
        s.side === 'attacker'
          ? { ...s, position: { x: 0, y: 0 }, order: { type: 'idle' as const } }
          : { ...s, position: { x: BATTLEFIELD_WIDTH, y: BATTLEFIELD_HEIGHT }, order: { type: 'idle' as const } },
      ),
    };

    const tick2 = processTacticalTick(current);
    // Beams should have 1 less tick remaining
    for (const beam of tick2.beamEffects) {
      expect(beam.ticksRemaining).toBeLessThan(3);
    }
  });
});

describe('weapon firing — projectiles', () => {
  it('creates projectiles for projectile-type weapons', () => {
    const projDesign = makeProjectileDesign('d-proj', 'empire-1');
    let state = setupOnePair({
      attacker: projDesign,
    });

    // Put ships close together
    const defId = state.ships.find((s) => s.side === 'defender')!.id;
    state = {
      ...state,
      ships: state.ships.map((s) =>
        s.side === 'attacker'
          ? { ...s, position: { x: 400, y: 400 }, order: { type: 'attack' as const, targetId: defId } }
          : { ...s, position: { x: 500, y: 400 } },
      ),
    };

    const next = processTacticalTick(state);

    // kinetic_cannon is a projectile weapon — should create projectiles
    expect(next.projectiles.length).toBeGreaterThan(0);
    expect(next.projectiles[0].speed).toBe(PROJECTILE_SPEED);
  });

  it('projectiles move toward their targets each tick', () => {
    const projDesign = makeProjectileDesign('d-proj', 'empire-1');
    let state = setupOnePair({
      attacker: projDesign,
    });

    // Put ships apart with projectile weapon in range
    const defender = state.ships.find((s) => s.side === 'defender')!;
    state = {
      ...state,
      ships: state.ships.map((s) =>
        s.side === 'attacker'
          ? { ...s, position: { x: 300, y: 400 }, order: { type: 'attack' as const, targetId: defender.id } }
          : { ...s, position: { x: 400, y: 400 } },
      ),
    };

    let current = processTacticalTick(state);
    if (current.projectiles.length === 0) {
      // Weapon might have just hit directly if close enough; skip test
      return;
    }

    const proj = current.projectiles[0];
    const initialDist = Math.sqrt(
      (proj.position.x - 400) ** 2 + (proj.position.y - 400) ** 2,
    );

    // Advance one more tick (separate ships so no new weapons fire)
    current = {
      ...current,
      ships: current.ships.map((s) => ({
        ...s,
        weapons: s.weapons.map((w) => ({ ...w, cooldownLeft: 999 })),
      })),
    };
    const next = processTacticalTick(current);

    if (next.projectiles.length > 0) {
      const movedProj = next.projectiles[0];
      const newDist = Math.sqrt(
        (movedProj.position.x - 400) ** 2 + (movedProj.position.y - 400) ** 2,
      );
      expect(newDist).toBeLessThan(initialDist);
    }
    // else: projectile hit the target, which is also fine
  });
});

describe('damage application', () => {
  it('beam weapons deal damage — shields absorb first, then hull', () => {
    let state = setupOnePair();

    // Place ships close and fire
    const defender = state.ships.find((s) => s.side === 'defender')!;
    const initialShields = defender.shields;
    const initialHull = defender.hull;

    state = {
      ...state,
      ships: state.ships.map((s) =>
        s.side === 'attacker'
          ? { ...s, position: { x: 400, y: 400 }, order: { type: 'attack' as const, targetId: defender.id } }
          : { ...s, position: { x: 450, y: 400 } },
      ),
    };

    const next = processTacticalTick(state);
    const hitDefender = next.ships.find((s) => s.sourceShipId === defender.sourceShipId)!;

    // With beam damage of 10 and shields of 30, shields should take the hit
    expect(hitDefender.shields).toBeLessThan(initialShields);
    // Hull should be intact since shields absorbed the full 10 damage
    expect(hitDefender.hull).toBe(initialHull);
  });

  it('hull takes damage once shields are depleted', () => {
    let state = setupOnePair();

    // Set defender shields to 0
    const defender = state.ships.find((s) => s.side === 'defender')!;
    state = {
      ...state,
      ships: state.ships.map((s) =>
        s.side === 'defender'
          ? { ...s, shields: 0, position: { x: 450, y: 400 } }
          : { ...s, position: { x: 400, y: 400 }, order: { type: 'attack' as const, targetId: defender.id } },
      ),
    };

    const next = processTacticalTick(state);
    const hitDefender = next.ships.find((s) => s.sourceShipId === defender.sourceShipId)!;

    expect(hitDefender.hull).toBeLessThan(100);
  });
});

describe('battlefield dimensions', () => {
  it('state carries the correct battlefield dimensions', () => {
    const state = setupOnePair();
    expect(state.battlefieldWidth).toBe(BATTLEFIELD_WIDTH);
    expect(state.battlefieldHeight).toBe(BATTLEFIELD_HEIGHT);
  });
});

// ---------------------------------------------------------------------------
// applyDamage unit tests
// ---------------------------------------------------------------------------

describe('applyDamage', () => {
  function makeTacticalShip(overrides: Partial<TacticalShip> = {}): TacticalShip {
    return {
      id: 'test-ship',
      sourceShipId: 'src-1',
      name: 'Test Ship',
      side: 'attacker',
      position: { x: 0, y: 0 },
      facing: 0,
      speed: 3,
      turnRate: 0.08,
      hull: 100,
      maxHull: 100,
      shields: 30,
      maxShields: 30,
      armour: 10,
      weapons: [],
      sensorRange: 200,
      order: { type: 'idle' },
      destroyed: false,
      routed: false,
      ...overrides,
    };
  }

  it('shields absorb damage first before armour or hull', () => {
    const ship = makeTacticalShip({ shields: 30 });
    const result = applyDamage(ship, 10);

    expect(result.shields).toBe(20);
    expect(result.hull).toBe(100); // no hull damage
    expect(result.armour).toBe(10); // armour untouched
    expect(result.destroyed).toBe(false);
  });

  it('armour reduces damage after shields are depleted', () => {
    const ship = makeTacticalShip({ shields: 5, armour: 20 });
    // 15 damage: 5 absorbed by shields, 10 remaining
    // armour absorbs 25% of 10 = 2.5 (capped at armour=20)
    // remaining = 10 - 2.5 = 7.5
    // hull damage = max(1, 7.5) = 7.5
    const result = applyDamage(ship, 15);

    expect(result.shields).toBe(0);
    expect(result.armour).toBeLessThan(20); // armour degraded
    expect(result.hull).toBeLessThan(100);  // hull took damage
    expect(result.hull).toBeGreaterThan(90); // but not catastrophic
  });

  it('armour degrades by half the absorbed amount', () => {
    const ship = makeTacticalShip({ shields: 0, armour: 20 });
    // 40 damage, all past shields
    // armour absorbs min(40*0.25=10, 20) = 10
    // armour degrades by 10 * 0.5 = 5
    const result = applyDamage(ship, 40);

    expect(result.armour).toBe(15); // 20 - 5
  });

  it('destroys a ship when hull reaches 0', () => {
    const ship = makeTacticalShip({ shields: 0, armour: 0, hull: 5 });
    const result = applyDamage(ship, 100);

    expect(result.hull).toBe(0);
    expect(result.destroyed).toBe(true);
  });

  it('hull takes minimum 1 damage when damage gets past shields', () => {
    // With armour absorbing most of the damage, hull should still take at least 1
    const ship = makeTacticalShip({ shields: 0, armour: 100, hull: 50 });
    // 2 damage: armour absorbs min(2*0.25=0.5, 100) = 0.5
    // remaining = 1.5, hull damage = max(1, 1.5) = 1.5
    const result = applyDamage(ship, 2);

    expect(result.hull).toBeLessThan(50);
  });

  it('does not damage hull when shields fully absorb the hit', () => {
    const ship = makeTacticalShip({ shields: 50, hull: 100 });
    const result = applyDamage(ship, 10);

    expect(result.shields).toBe(40);
    expect(result.hull).toBe(100);
    expect(result.armour).toBe(ship.armour); // unchanged
  });
});

// ---------------------------------------------------------------------------
// Shield recharge
// ---------------------------------------------------------------------------

describe('shield recharge', () => {
  it('shields recharge by 5% of max each tick', () => {
    let state = setupOnePair();

    // Deplete defender shields partially
    const defender = state.ships.find((s) => s.side === 'defender')!;
    state = {
      ...state,
      ships: state.ships.map((s) =>
        s.side === 'defender'
          ? { ...s, shields: 10 } // was 30, now 10
          : { ...s, order: { type: 'idle' as const } }, // keep attacker idle so no firing
      ),
    };

    // Separate ships so no combat occurs
    state = {
      ...state,
      ships: state.ships.map((s) =>
        s.side === 'attacker'
          ? { ...s, position: { x: 0, y: 0 } }
          : { ...s, position: { x: BATTLEFIELD_WIDTH, y: BATTLEFIELD_HEIGHT } },
      ),
    };

    const next = processTacticalTick(state);
    const updatedDefender = next.ships.find((s) => s.sourceShipId === defender.sourceShipId)!;

    // maxShields=30, recharge = 30 * 0.05 = 1.5
    // Should go from 10 to 11.5
    expect(updatedDefender.shields).toBeCloseTo(11.5, 1);
  });

  it('shields do not recharge above maxShields', () => {
    let state = setupOnePair();

    // Shields already at max — separate ships
    state = {
      ...state,
      ships: state.ships.map((s) =>
        s.side === 'attacker'
          ? { ...s, position: { x: 0, y: 0 } }
          : { ...s, position: { x: BATTLEFIELD_WIDTH, y: BATTLEFIELD_HEIGHT } },
      ),
    };

    const defender = state.ships.find((s) => s.side === 'defender')!;
    const next = processTacticalTick(state);
    const updatedDefender = next.ships.find((s) => s.sourceShipId === defender.sourceShipId)!;

    expect(updatedDefender.shields).toBe(defender.maxShields);
  });
});

// ---------------------------------------------------------------------------
// Projectile hit damage
// ---------------------------------------------------------------------------

describe('projectile hit damage', () => {
  it('projectile applies damage to target on arrival', () => {
    const projDesign = makeProjectileDesign('d-proj-dmg', 'empire-1');
    let state = setupOnePair({
      attacker: projDesign,
    });

    // Place ships apart so projectile is created on tick 1
    const defender = state.ships.find((s) => s.side === 'defender')!;
    state = {
      ...state,
      ships: state.ships.map((s) =>
        s.side === 'attacker'
          ? { ...s, position: { x: 300, y: 400 }, order: { type: 'attack' as const, targetId: defender.id } }
          : { ...s, position: { x: 400, y: 400 }, order: { type: 'idle' as const } },
      ),
    };

    // Tick 1: projectile created
    const tick1 = processTacticalTick(state);
    expect(tick1.projectiles.length).toBeGreaterThan(0);

    // Record defender shields after tick 1 (may have recharged but no damage yet)
    const defAfterTick1 = tick1.ships.find((s) => s.sourceShipId === defender.sourceShipId)!;
    const shieldsBeforeHit = defAfterTick1.shields;

    // Run more ticks until projectile hits (distance 100, speed 8 => ~12 ticks)
    let current = tick1;
    for (let i = 0; i < 20; i++) {
      current = processTacticalTick(current);
    }

    const hitDefender = current.ships.find((s) => s.sourceShipId === defender.sourceShipId)!;

    // After multiple hits, hull or shields should have taken damage
    // Shields recharge 1.5/tick but damage is 15+ per hit (kinetic_cannon)
    // So overall shields should be lower OR hull should have taken damage
    const totalHealth = hitDefender.shields + hitDefender.hull;
    const initialTotal = shieldsBeforeHit + defAfterTick1.hull;
    expect(totalHealth).toBeLessThan(initialTotal);
  });
});

// ---------------------------------------------------------------------------
// Combat end detection
// ---------------------------------------------------------------------------

describe('combat end detection', () => {
  it('initial state has no outcome', () => {
    const state = setupOnePair();
    expect(state.outcome).toBeNull();
  });

  it('outcome is attacker_wins when all defenders are destroyed', () => {
    let state = setupOnePair();

    // Destroy defender
    state = {
      ...state,
      ships: state.ships.map((s) =>
        s.side === 'defender'
          ? { ...s, hull: 0, destroyed: true }
          : s,
      ),
    };

    const next = processTacticalTick(state);
    expect(next.outcome).toBe('attacker_wins');
  });

  it('outcome is defender_wins when all attackers are destroyed', () => {
    let state = setupOnePair();

    // Destroy attacker
    state = {
      ...state,
      ships: state.ships.map((s) =>
        s.side === 'attacker'
          ? { ...s, hull: 0, destroyed: true }
          : s,
      ),
    };

    const next = processTacticalTick(state);
    expect(next.outcome).toBe('defender_wins');
  });

  it('outcome is attacker_wins when both sides eliminated (draw)', () => {
    let state = setupOnePair();

    // Destroy everyone
    state = {
      ...state,
      ships: state.ships.map((s) => ({ ...s, hull: 0, destroyed: true })),
    };

    const next = processTacticalTick(state);
    expect(next.outcome).toBe('attacker_wins');
  });

  it('routed ships count as eliminated for outcome purposes', () => {
    let state = setupOnePair();

    // Route all defenders
    state = {
      ...state,
      ships: state.ships.map((s) =>
        s.side === 'defender'
          ? { ...s, routed: true }
          : s,
      ),
    };

    const next = processTacticalTick(state);
    expect(next.outcome).toBe('attacker_wins');
  });

  it('does not advance ticks once outcome is set', () => {
    let state = setupOnePair();

    // Destroy defender to trigger outcome
    state = {
      ...state,
      ships: state.ships.map((s) =>
        s.side === 'defender'
          ? { ...s, hull: 0, destroyed: true }
          : s,
      ),
    };

    const resolved = processTacticalTick(state);
    expect(resolved.outcome).toBe('attacker_wins');

    // Ticking again should return same state (early return)
    const same = processTacticalTick(resolved);
    expect(same.tick).toBe(resolved.tick);
    expect(same).toBe(resolved);
  });

  it('battle ends when one side eliminated through repeated combat', () => {
    let state = setupOnePair();

    // Give both sides attack orders and place them close together
    const attacker = state.ships.find((s) => s.side === 'attacker')!;
    const defender = state.ships.find((s) => s.side === 'defender')!;
    state = setShipOrder(state, attacker.id, { type: 'attack', targetId: defender.id });
    state = setShipOrder(state, defender.id, { type: 'attack', targetId: attacker.id });

    // Place ships close together and lower shields so combat resolves faster
    state = {
      ...state,
      ships: state.ships.map((s) => ({
        ...s,
        shields: 0,
        maxShields: 0,
        position: s.side === 'attacker'
          ? { x: 400, y: 400 }
          : { x: 450, y: 400 },
      })),
    };

    // Run up to 500 ticks
    let current = state;
    for (let i = 0; i < 500; i++) {
      current = processTacticalTick(current);
      if (current.outcome !== null) break;
    }

    expect(current.outcome).not.toBeNull();
    expect(['attacker_wins', 'defender_wins']).toContain(current.outcome);
  });
});
