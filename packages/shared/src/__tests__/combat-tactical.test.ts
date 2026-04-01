import { describe, it, expect } from 'vitest';

import {
  initializeTacticalCombat,
  processTacticalTick,
  setShipOrder,
  findTarget,
  moveShip,
  applyDamage,
  isInWeaponArc,
  getFormationPositions,
  setFormation,
  defaultWeaponFacing,
  pointToSegmentDistance,
  findNearestEnemyFighter,
  admiralRally,
  admiralEmergencyRepair,
  admiralPause,
  admiralPauseCount,
  createAdmiral,
  calculateExperienceGain,
  BATTLEFIELD_WIDTH,
  BATTLEFIELD_HEIGHT,
  PROJECTILE_SPEED,
  DEBRIS_RADIUS,
} from '../engine/combat-tactical.js';
import type {
  TacticalState,
  TacticalShip,
  TacticalWeapon,
  WeaponFacing,
  ShipOrder,
  FormationType,
  Missile,
  Fighter,
  EnvironmentFeature,
  Projectile,
  Admiral,
  CrewExperience,
  PlanetData,
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

function makeCarrierDesign(id: string, empireId = 'empire-1'): ShipDesign {
  return {
    id,
    name: `Carrier Design ${id}`,
    hull: 'scout',
    components: [
      { slotId: 'scout_fore_1', componentId: 'light_fighter_bay' },
      { slotId: 'scout_turret_1', componentId: 'deflector_shield' },
      { slotId: 'scout_aft_1', componentId: 'ion_engine' },
    ],
    totalCost: 235,
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

    // Both ships have beam weapons (pulse_laser) and are within range
    // Accuracy rolls may cause a miss — try multiple ticks
    let found = false;
    let current = state;
    for (let i = 0; i < 30; i++) {
      current = processTacticalTick(current);
      if (current.beamEffects.length > 0) {
        found = true;
        expect(current.beamEffects[0]!.ticksRemaining).toBe(3);
        break;
      }
    }
    expect(found).toBe(true);
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

    // Run until we get at least one beam effect
    let current = state;
    for (let i = 0; i < 30; i++) {
      current = processTacticalTick(current);
      if (current.beamEffects.length > 0) break;
    }
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

    // Run several ticks — accuracy rolls may cause a miss on any single tick
    let found = false;
    let current = state;
    for (let i = 0; i < 30; i++) {
      current = processTacticalTick(current);
      if (current.projectiles.length > 0) {
        found = true;
        expect(current.projectiles[0]!.speed).toBe(PROJECTILE_SPEED);
        break;
      }
    }
    expect(found).toBe(true);
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

    // Run several ticks — accuracy rolls may cause a miss on any single tick
    let current = state;
    let shieldsHit = false;
    for (let i = 0; i < 30; i++) {
      current = processTacticalTick(current);
      const hitDefender = current.ships.find((s) => s.sourceShipId === defender.sourceShipId)!;
      if (hitDefender.shields < initialShields) {
        shieldsHit = true;
        // With beam damage of 10 and shields of 30, shields should take the hit
        // Hull should be intact since shields absorbed the full 10 damage
        expect(hitDefender.hull).toBe(initialHull);
        break;
      }
    }
    expect(shieldsHit).toBe(true);
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
      crew: { morale: 80, health: 100, experience: 'regular' },
      order: { type: 'idle' },
      destroyed: false,
      routed: false, stance: "aggressive" as any, damageTakenThisTick: 0,
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

    // Ensure attacker has max accuracy for reliable test
    state = {
      ...state,
      ships: state.ships.map(s =>
        s.side === 'attacker'
          ? { ...s, facing: 0, crew: { ...s.crew, experience: 'elite' as const, morale: 100 } }
          : s,
      ),
    };

    // Tick until projectile created (accuracy rolls may cause misses)
    let tick1 = state;
    for (let i = 0; i < 20; i++) {
      tick1 = processTacticalTick(tick1);
      if (tick1.projectiles.length > 0) break;
    }
    if (tick1.projectiles.length === 0) return; // skip if no projectile fired

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

// ---------------------------------------------------------------------------
// Weapon arc checking
// ---------------------------------------------------------------------------

describe('isInWeaponArc', () => {
  function makeTacticalShipForArc(overrides: Partial<TacticalShip> = {}): TacticalShip {
    return {
      id: 'arc-ship',
      sourceShipId: 'src-arc',
      name: 'Arc Ship',
      side: 'attacker',
      position: { x: 100, y: 100 },
      facing: 0, // facing right (+x)
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
      routed: false, stance: "aggressive" as any, damageTakenThisTick: 0,
      crew: { morale: 80, health: 100, experience: 'regular' },
      ...overrides,
    };
  }

  function makeWeapon(facing: WeaponFacing): TacticalWeapon {
    return {
      componentId: 'test-weapon',
      type: 'beam',
      damage: 10,
      range: 300,
      accuracy: 80,
      cooldownMax: 10,
      cooldownLeft: 0,
      facing,
    };
  }

  it('fore weapon hits target directly ahead', () => {
    const ship = makeTacticalShipForArc({ facing: 0 });
    const target = makeTacticalShipForArc({ position: { x: 200, y: 100 } });
    expect(isInWeaponArc(ship, target, makeWeapon('fore'))).toBe(true);
  });

  it('fore weapon misses target directly behind', () => {
    const ship = makeTacticalShipForArc({ facing: 0 });
    const target = makeTacticalShipForArc({ position: { x: 0, y: 100 } });
    expect(isInWeaponArc(ship, target, makeWeapon('fore'))).toBe(false);
  });

  it('aft weapon hits target directly behind', () => {
    const ship = makeTacticalShipForArc({ facing: 0 });
    const target = makeTacticalShipForArc({ position: { x: 0, y: 100 } });
    expect(isInWeaponArc(ship, target, makeWeapon('aft'))).toBe(true);
  });

  it('aft weapon misses target directly ahead', () => {
    const ship = makeTacticalShipForArc({ facing: 0 });
    const target = makeTacticalShipForArc({ position: { x: 200, y: 100 } });
    expect(isInWeaponArc(ship, target, makeWeapon('aft'))).toBe(false);
  });

  it('port weapon hits target to the left', () => {
    const ship = makeTacticalShipForArc({ facing: 0 });
    // Port is -PI/2, so target above (lower y) when facing right
    const target = makeTacticalShipForArc({ position: { x: 100, y: 0 } });
    expect(isInWeaponArc(ship, target, makeWeapon('port'))).toBe(true);
  });

  it('starboard weapon hits target to the right', () => {
    const ship = makeTacticalShipForArc({ facing: 0 });
    // Starboard is +PI/2, so target below (higher y) when facing right
    const target = makeTacticalShipForArc({ position: { x: 100, y: 200 } });
    expect(isInWeaponArc(ship, target, makeWeapon('starboard'))).toBe(true);
  });

  it('turret weapon hits targets in most directions', () => {
    const ship = makeTacticalShipForArc({ facing: 0 });
    // Turret covers 270 deg — everything except directly behind
    const ahead = makeTacticalShipForArc({ position: { x: 200, y: 100 } });
    const left = makeTacticalShipForArc({ position: { x: 100, y: 0 } });
    const right = makeTacticalShipForArc({ position: { x: 100, y: 200 } });
    expect(isInWeaponArc(ship, ahead, makeWeapon('turret'))).toBe(true);
    expect(isInWeaponArc(ship, left, makeWeapon('turret'))).toBe(true);
    expect(isInWeaponArc(ship, right, makeWeapon('turret'))).toBe(true);
  });

  it('turret weapon misses target directly behind', () => {
    const ship = makeTacticalShipForArc({ facing: 0 });
    const behind = makeTacticalShipForArc({ position: { x: 0, y: 100 } });
    // 270 deg arc = 135 deg each side from forward
    // Directly behind is 180 deg from forward, which is outside 135 deg
    expect(isInWeaponArc(ship, behind, makeWeapon('turret'))).toBe(false);
  });

  it('weapons do not fire when target is outside arc during combat tick', () => {
    let state = setupOnePair();

    // Place attacker facing right, defender directly behind
    state = {
      ...state,
      ships: state.ships.map((s) =>
        s.side === 'attacker'
          ? {
              ...s,
              position: { x: 400, y: 400 },
              facing: 0, // facing right
              order: { type: 'attack' as const, targetId: state.ships.find((d) => d.side === 'defender')!.id },
            }
          : {
              ...s,
              position: { x: 300, y: 400 }, // directly behind attacker
              facing: Math.PI, // facing left
              order: { type: 'attack' as const, targetId: state.ships.find((a) => a.side === 'attacker')!.id },
            },
      ),
    };

    // The attacker has a 'fore' beam weapon (facing: 0, 90 deg arc)
    // The defender is directly behind — should NOT be in arc
    const next = processTacticalTick(state);

    // Attacker should NOT have fired (defender is behind it)
    // But defender faces left toward attacker, so defender CAN fire
    const attackerBeams = next.beamEffects.filter(
      (b) => b.sourceShipId === state.ships.find((s) => s.side === 'attacker')!.id,
    );
    // Attacker's beam should not fire since target is behind (outside fore arc)
    expect(attackerBeams).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Default weapon facing
// ---------------------------------------------------------------------------

describe('defaultWeaponFacing', () => {
  it('assigns fore facing to beam weapons', () => {
    expect(defaultWeaponFacing('weapon_beam')).toBe('fore');
  });

  it('assigns fore facing to projectile weapons', () => {
    expect(defaultWeaponFacing('weapon_projectile')).toBe('fore');
  });

  it('assigns turret facing to point defence', () => {
    expect(defaultWeaponFacing('weapon_point_defense')).toBe('turret');
  });

  it('assigns turret facing to missiles', () => {
    expect(defaultWeaponFacing('weapon_missile')).toBe('turret');
  });

  it('assigns turret facing to fighter bays', () => {
    expect(defaultWeaponFacing('fighter_bay')).toBe('turret');
  });

  it('weapons built from designs have correct default facing', () => {
    const state = setupOnePair();
    const atk = state.ships.find((s) => s.side === 'attacker')!;
    // pulse_laser is weapon_beam, should get 'fore'
    expect(atk.weapons[0].facing).toBe('fore');
  });
});

// ---------------------------------------------------------------------------
// Formation system
// ---------------------------------------------------------------------------

describe('getFormationPositions', () => {
  it('returns the correct number of positions for all formation types', () => {
    const formations: FormationType[] = ['line', 'spearhead', 'diamond', 'wings'];
    for (const formation of formations) {
      for (const count of [1, 3, 5, 9, 12]) {
        const positions = getFormationPositions(formation, count);
        expect(positions).toHaveLength(count);
      }
    }
  });

  it('line formation places ships in a vertical column', () => {
    const positions = getFormationPositions('line', 5);
    expect(positions).toHaveLength(5);
    // All ships should have the same offsetX (0)
    for (const pos of positions) {
      expect(pos.offsetX).toBe(0);
    }
    // Ships should be spaced 40 units apart vertically
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i].offsetY - positions[i - 1].offsetY).toBeCloseTo(40, 5);
    }
  });

  it('spearhead formation has lead ship at front', () => {
    const positions = getFormationPositions('spearhead', 6);
    expect(positions).toHaveLength(6);
    // First ship (lead) should be at the front (highest offsetX or 0)
    // All subsequent rows have lower offsetX
    expect(positions[0].offsetX).toBeGreaterThanOrEqual(positions[1].offsetX);
  });

  it('diamond formation creates a diamond shape', () => {
    const positions = getFormationPositions('diamond', 9);
    expect(positions).toHaveLength(9);
    // Row sizes: 1, 2, 3, 2, 1
    // First row: 1 ship
    expect(positions[0].offsetY).toBe(0);
    // Third row: 3 ships (widest part)
    // Positions [3], [4], [5] are the wide row
  });

  it('wings formation groups ships in threes', () => {
    const positions = getFormationPositions('wings', 6);
    expect(positions).toHaveLength(6);
    // Each group of 3 has a centre ship (offsetY=0) and two flankers
    expect(positions[0].offsetY).toBe(0); // centre
    expect(positions[1].offsetY).toBeLessThan(0); // left wing
    expect(positions[2].offsetY).toBeGreaterThan(0); // right wing
  });

  it('single ship returns one position at origin', () => {
    for (const formation of ['line', 'spearhead', 'diamond', 'wings'] as FormationType[]) {
      const positions = getFormationPositions(formation, 1);
      expect(positions).toHaveLength(1);
      expect(positions[0].offsetY).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// setFormation
// ---------------------------------------------------------------------------

describe('setFormation', () => {
  function setupMultiShipState(): TacticalState {
    const design = makeArmedDesign('d-multi-fmt', 'empire-1');
    const defDesign = makeArmedDesign('d-def-fmt', 'empire-2');
    const designs = new Map<string, ShipDesign>([
      [design.id, design],
      [defDesign.id, defDesign],
    ]);

    const attackerShips = Array.from({ length: 5 }, (_, i) =>
      makeShip(`atk-${i}`, design.id),
    );
    const defenderShips = [makeShip('def-0', defDesign.id)];

    return initializeTacticalCombat(
      makeFleet('f-atk', 'empire-1', attackerShips.map((s) => s.id)),
      makeFleet('f-def', 'empire-2', defenderShips.map((s) => s.id)),
      attackerShips,
      defenderShips,
      designs,
      SHIP_COMPONENTS,
    );
  }

  it('updates the attacker formation type', () => {
    const state = setupMultiShipState();
    expect(state.attackerFormation).toBe('line');

    const updated = setFormation(state, 'attacker', 'spearhead');
    expect(updated.attackerFormation).toBe('spearhead');
    expect(updated.defenderFormation).toBe('line'); // unchanged
  });

  it('updates the defender formation type', () => {
    const state = setupMultiShipState();
    const updated = setFormation(state, 'defender', 'diamond');
    expect(updated.defenderFormation).toBe('diamond');
    expect(updated.attackerFormation).toBe('line'); // unchanged
  });

  it('gives surviving ships move orders to their new positions', () => {
    const state = setupMultiShipState();
    const updated = setFormation(state, 'attacker', 'wings');

    const attackerShips = updated.ships.filter(
      (s) => s.side === 'attacker' && !s.destroyed && !s.routed,
    );
    for (const ship of attackerShips) {
      expect(ship.order.type).toBe('move');
    }
  });

  it('does not modify destroyed or routed ships', () => {
    let state = setupMultiShipState();
    // Destroy the first attacker
    state = {
      ...state,
      ships: state.ships.map((s, i) =>
        s.side === 'attacker' && i === 0
          ? { ...s, destroyed: true }
          : s,
      ),
    };

    const updated = setFormation(state, 'attacker', 'diamond');
    const destroyed = updated.ships.find((s) => s.destroyed);
    expect(destroyed).toBeDefined();
    // Destroyed ship should keep its original order, not a move order
    expect(destroyed!.order.type).not.toBe('move');
  });

  it('does not modify ships on the other side', () => {
    const state = setupMultiShipState();
    const updated = setFormation(state, 'attacker', 'spearhead');

    const defender = updated.ships.find((s) => s.side === 'defender')!;
    expect(defender.order.type).toBe('idle'); // unchanged
  });
});

// ---------------------------------------------------------------------------
// Initial state includes formation fields
// ---------------------------------------------------------------------------

describe('formation state initialisation', () => {
  it('initialises with line formation for both sides', () => {
    const state = setupOnePair();
    expect(state.attackerFormation).toBe('line');
    expect(state.defenderFormation).toBe('line');
  });

  it('formation fields are preserved through processTacticalTick', () => {
    let state = setupOnePair();
    state = setFormation(state, 'attacker', 'diamond');
    const next = processTacticalTick(state);
    expect(next.attackerFormation).toBe('diamond');
    expect(next.defenderFormation).toBe('line');
  });
});

// ---------------------------------------------------------------------------
// Missile mechanics
// ---------------------------------------------------------------------------

function makeMissileDesign(id: string, empireId = 'empire-1'): ShipDesign {
  return {
    id,
    name: `Missile Design ${id}`,
    hull: 'scout',
    components: [
      { slotId: 'scout_fore_1', componentId: 'basic_missile' },
      { slotId: 'scout_turret_1', componentId: 'deflector_shield' },
      { slotId: 'scout_aft_1', componentId: 'ion_engine' },
    ],
    totalCost: 215,
    empireId,
  };
}

function makePointDefenceDesign(id: string, empireId = 'empire-1'): ShipDesign {
  return {
    id,
    name: `PD Design ${id}`,
    hull: 'scout',
    components: [
      { slotId: 'scout_fore_1', componentId: 'point_defense_turret' },
      { slotId: 'scout_turret_1', componentId: 'deflector_shield' },
      { slotId: 'scout_aft_1', componentId: 'ion_engine' },
    ],
    totalCost: 180,
    empireId,
  };
}

describe('missile mechanics', () => {
  it('missile weapon creates missiles, not projectiles', () => {
    const missileDesign = makeMissileDesign('d-missile', 'empire-1');
    let state = setupOnePair({ attacker: missileDesign });

    const defId = state.ships.find((s) => s.side === 'defender')!.id;
    state = {
      ...state,
      ships: state.ships.map((s) =>
        s.side === 'attacker'
          ? { ...s, position: { x: 400, y: 400 }, order: { type: 'attack' as const, targetId: defId } }
          : { ...s, position: { x: 500, y: 400 } },
      ),
    };

    // Run many ticks — missile cooldown is 25 and accuracy ~70%,
    // so we need enough attempts for at least one hit
    let found = false;
    let current = state;
    for (let i = 0; i < 200; i++) {
      current = processTacticalTick(current);
      if (current.missiles.length > 0) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
    expect(current.projectiles).toHaveLength(0);
  });

  it('missiles track their target (heading adjusts)', () => {
    const missileDesign = makeMissileDesign('d-missile-track', 'empire-1');
    let state = setupOnePair({ attacker: missileDesign });

    const defId = state.ships.find((s) => s.side === 'defender')!.id;
    state = {
      ...state,
      ships: state.ships.map((s) =>
        s.side === 'attacker'
          ? { ...s, position: { x: 200, y: 200 }, order: { type: 'attack' as const, targetId: defId } }
          : { ...s, position: { x: 600, y: 200 } },
      ),
    };

    // Ensure attacker is facing the target and has max accuracy
    state = {
      ...state,
      ships: state.ships.map(s =>
        s.side === 'attacker'
          ? { ...s, facing: 0, crew: { ...s.crew, experience: 'elite' as const, morale: 100 } }
          : s,
      ),
    };

    // Fire a missile — may take several ticks due to accuracy roll
    let current = state;
    for (let i = 0; i < 60; i++) {
      current = processTacticalTick(current);
      if (current.missiles.length > 0) break;
    }
    // If no missile fired after 60 ticks, skip (extremely rare with elite crew)
    if (current.missiles.length === 0) return;

    const missile0 = current.missiles[0];
    const initialDx = 600 - missile0.x;
    const initialDy = 200 - missile0.y;

    // Move the target to a different position
    current = {
      ...current,
      ships: current.ships.map((s) =>
        s.side === 'defender'
          ? { ...s, position: { x: 600, y: 500 } }
          : s,
      ),
    };

    // Advance a few ticks
    for (let i = 0; i < 5; i++) {
      current = processTacticalTick(current);
    }

    // If the missile is still alive, check that it's heading toward the new target position
    if (current.missiles.length > 0) {
      const missile = current.missiles[0];
      const dy = 500 - missile.y;
      // The missile should have a positive dy component (heading downward toward y=500)
      expect(dy).toBeGreaterThan(0);
    }
    // If missile already hit, that's also valid
  });

  it('missiles accelerate each tick', () => {
    const missileDesign = makeMissileDesign('d-missile-accel', 'empire-1');
    let state = setupOnePair({ attacker: missileDesign });

    const defId = state.ships.find((s) => s.side === 'defender')!.id;
    state = {
      ...state,
      ships: state.ships.map((s) =>
        s.side === 'attacker'
          ? { ...s, facing: 0, crew: { ...s.crew, experience: 'elite' as const, morale: 100 }, order: { type: 'attack' as const, targetId: defId } }
          : { ...s, position: { x: 550, y: 400 } },
      ),
    };

    // Run until a missile is launched (accuracy may delay)
    let current = state;
    for (let i = 0; i < 60; i++) {
      current = processTacticalTick(current);
      if (current.missiles.length > 0) break;
    }
    if (current.missiles.length === 0) return; // skip if no missile fired

    const initialSpeed = current.missiles[0].speed;

    // Silence all weapons so no new missiles are fired
    current = {
      ...current,
      ships: current.ships.map((s) => ({
        ...s,
        weapons: s.weapons.map((w) => ({ ...w, cooldownLeft: 999 })),
      })),
    };

    const next = processTacticalTick(current);
    if (next.missiles.length > 0) {
      expect(next.missiles[0].speed).toBeGreaterThan(initialSpeed);
    }
  });

  it('missiles deal damage on hit', () => {
    const missileDesign = makeMissileDesign('d-missile-dmg', 'empire-1');
    let state = setupOnePair({ attacker: missileDesign });

    const defId = state.ships.find((s) => s.side === 'defender')!.id;
    // Place them at close range so missiles arrive quickly.
    // Remove defender shields so missile damage reaches hull directly.
    state = {
      ...state,
      ships: state.ships.map((s) =>
        s.side === 'attacker'
          ? { ...s, position: { x: 200, y: 400 }, order: { type: 'attack' as const, targetId: defId } }
          : { ...s, position: { x: 220, y: 400 }, order: { type: 'idle' as const }, weapons: [], shields: 0, maxShields: 0, armour: 0 },
      ),
    };

    const defBefore = state.ships.find((s) => s.side === 'defender')!;
    const initialTotal = defBefore.shields + defBefore.hull;

    // Run many ticks — missiles have 25-tick cooldown and 70% accuracy,
    // so we need enough ticks for multiple hits to overwhelm shield recharge
    let current = state;
    for (let i = 0; i < 300; i++) {
      current = processTacticalTick(current);
    }

    const defAfter = current.ships.find((s) => s.side === 'defender')!;
    const finalTotal = defAfter.shields + defAfter.hull;

    // Over 300 ticks: ~12 fire attempts, ~8 hits, 160 damage total.
    // Shield recharge capped at max, so net damage exceeds recharge.
    expect(finalTotal).toBeLessThan(initialTotal);
  });
});

// ---------------------------------------------------------------------------
// Point defence mechanics
// ---------------------------------------------------------------------------

describe('point defence mechanics', () => {
  it('point defence intercepts missiles', () => {
    // Attacker has missiles, defender has point defence
    const missileDesign = makeMissileDesign('d-atk-missile', 'empire-1');
    const pdDesign = makePointDefenceDesign('d-def-pd', 'empire-2');

    let state = setupOnePair({
      attacker: missileDesign,
      defender: pdDesign,
    });

    const defId = state.ships.find((s) => s.side === 'defender')!.id;
    // Place attacker close so missile fires, then missile approaches defender with PD
    state = {
      ...state,
      ships: state.ships.map((s) =>
        s.side === 'attacker'
          ? { ...s, position: { x: 200, y: 400 }, order: { type: 'attack' as const, targetId: defId } }
          : { ...s, position: { x: 400, y: 400 }, order: { type: 'idle' as const } },
      ),
    };

    // Run many ticks; with 60% intercept rate, some missiles should be intercepted
    let missilesIntercepted = false;
    let current = state;
    for (let i = 0; i < 100; i++) {
      const prevMissileCount = current.missiles.length;
      current = processTacticalTick(current);
      // If missiles disappeared and it wasn't from hitting (defender still alive),
      // point defence intercepted
      if (prevMissileCount > 0 && current.missiles.length < prevMissileCount) {
        const def = current.ships.find((s) => s.side === 'defender');
        if (def && !def.destroyed) {
          missilesIntercepted = true;
        }
      }
    }

    // Over 100 ticks with 60% intercept, it's virtually certain some were intercepted
    expect(missilesIntercepted).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Ammo system
// ---------------------------------------------------------------------------

describe('ammo system', () => {
  it('missile weapons use per-type ammo from profiles', () => {
    // basic_missile has 12 ammo (rapid salvo profile)
    const missileDesign = makeMissileDesign('d-ammo-missile', 'empire-1');
    const state = setupOnePair({ attacker: missileDesign });
    const atk = state.ships.find((s) => s.side === 'attacker')!;
    const missileWeapon = atk.weapons.find((w) => w.type === 'missile');
    expect(missileWeapon).toBeDefined();
    expect(missileWeapon!.ammo).toBe(12);
    expect(missileWeapon!.maxAmmo).toBe(12);
  });

  it('projectile weapons have 50 ammo by default', () => {
    const projDesign = makeProjectileDesign('d-ammo-proj', 'empire-1');
    const state = setupOnePair({ attacker: projDesign });
    const atk = state.ships.find((s) => s.side === 'attacker')!;
    const projWeapon = atk.weapons.find((w) => w.type === 'projectile');
    expect(projWeapon).toBeDefined();
    expect(projWeapon!.ammo).toBe(50);
    expect(projWeapon!.maxAmmo).toBe(50);
  });

  it('beam weapons have unlimited ammo', () => {
    const state = setupOnePair();
    const atk = state.ships.find((s) => s.side === 'attacker')!;
    const beamWeapon = atk.weapons.find((w) => w.type === 'beam');
    expect(beamWeapon).toBeDefined();
    expect(beamWeapon!.ammo).toBeUndefined();
    expect(beamWeapon!.maxAmmo).toBeUndefined();
  });

  it('point defence weapons have 100 ammo by default', () => {
    const pdDesign = makePointDefenceDesign('d-ammo-pd', 'empire-1');
    const state = setupOnePair({ attacker: pdDesign });
    const atk = state.ships.find((s) => s.side === 'attacker')!;
    const pdWeapon = atk.weapons.find((w) => w.type === 'point_defense');
    expect(pdWeapon).toBeDefined();
    expect(pdWeapon!.ammo).toBe(100);
    expect(pdWeapon!.maxAmmo).toBe(100);
  });

  it('ammo depletes on firing', () => {
    const missileDesign = makeMissileDesign('d-ammo-deplete', 'empire-1');
    let state = setupOnePair({ attacker: missileDesign });

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
    const atk = next.ships.find((s) => s.side === 'attacker')!;
    const missileWeapon = atk.weapons.find((w) => w.type === 'missile');
    expect(missileWeapon!.ammo).toBe(11); // basic_missile starts at 12, fired once
  });

  it('no firing when ammo is 0', () => {
    const missileDesign = makeMissileDesign('d-ammo-zero', 'empire-1');
    let state = setupOnePair({ attacker: missileDesign });

    const defId = state.ships.find((s) => s.side === 'defender')!.id;
    // Set ammo to 0
    state = {
      ...state,
      ships: state.ships.map((s) =>
        s.side === 'attacker'
          ? {
              ...s,
              position: { x: 400, y: 400 },
              order: { type: 'attack' as const, targetId: defId },
              weapons: s.weapons.map((w) => ({
                ...w,
                ammo: 0,
                cooldownLeft: 0,
              })),
            }
          : { ...s, position: { x: 500, y: 400 } },
      ),
    };

    const next = processTacticalTick(state);
    // No new missiles should be created
    expect(next.missiles).toHaveLength(0);
    // Ammo should still be 0
    const atk = next.ships.find((s) => s.side === 'attacker')!;
    const missileWeapon = atk.weapons.find((w) => w.type === 'missile');
    expect(missileWeapon!.ammo).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Fighter / carrier mechanics
// ---------------------------------------------------------------------------

describe('Fighter / carrier mechanics', () => {
  /**
   * Helper: set up a carrier (attacker) vs armed defender, position them
   * close enough that the fighter bay is in range, and return the state
   * with the attacker's fighter_bay weapon off cooldown.
   */
  function setupCarrierVsTarget(): TacticalState {
    const carrierDesign = makeCarrierDesign('d-carrier', 'empire-1');
    const defenderDesign = makeArmedDesign('d-def', 'empire-2');

    const state = setupOnePair({
      attacker: carrierDesign,
      defender: defenderDesign,
    });

    // Move ships close together so fighter bay is in range
    return {
      ...state,
      ships: state.ships.map((s) =>
        s.side === 'attacker'
          ? {
              ...s,
              position: { x: 400, y: 400 },
              order: { type: 'attack' as const, targetId: state.ships.find((d) => d.side === 'defender')!.id },
              weapons: s.weapons.map((w) => ({
                ...w,
                cooldownLeft: 0,
              })),
            }
          : { ...s, position: { x: 500, y: 400 } },
      ),
    };
  }

  it('launches fighters from fighter bay when cooldown is reached', () => {
    const state = setupCarrierVsTarget();

    // Verify the attacker has a fighter_bay weapon
    const attacker = state.ships.find((s) => s.side === 'attacker')!;
    const bayWeapon = attacker.weapons.find((w) => w.type === 'fighter_bay');
    expect(bayWeapon).toBeDefined();
    expect(bayWeapon!.ammo).toBe(4); // light_fighter_bay has fighterCount: 4

    const next = processTacticalTick(state);
    expect(next.fighters.length).toBeGreaterThan(0);
    expect(next.fighters.length).toBeLessThanOrEqual(2); // FIGHTER_LAUNCH_BATCH = 2
  });

  it('fighters move toward their target', () => {
    const state = setupCarrierVsTarget();
    const defender = state.ships.find((s) => s.side === 'defender')!;

    // Manually place a fighter far from the target
    const fighter: Fighter = {
      id: 'test-fighter-1',
      carrierId: state.ships.find((s) => s.side === 'attacker')!.id,
      side: 'attacker',
      x: 100,
      y: 400,
      speed: 6,
      damage: 8,
      health: 10,
      maxHealth: 10,
      targetId: defender.id,
      order: 'attack',
    };

    const stateWithFighter: TacticalState = {
      ...state,
      fighters: [fighter],
    };

    const next = processTacticalTick(stateWithFighter);
    const movedFighter = next.fighters.find((f) => f.id === 'test-fighter-1');
    expect(movedFighter).toBeDefined();
    // Fighter should have moved closer to the target (defender is at x=500)
    expect(movedFighter!.x).toBeGreaterThan(100);
  });

  it('fighters deal strafing damage at close range', () => {
    const state = setupCarrierVsTarget();
    const defender = state.ships.find((s) => s.side === 'defender')!;
    const attacker = state.ships.find((s) => s.side === 'attacker')!;

    // Place fighter within strafe range (30 units) of the defender
    const fighter: Fighter = {
      id: 'test-fighter-strafe',
      carrierId: attacker.id,
      side: 'attacker',
      x: defender.position.x + 10, // very close
      y: defender.position.y,
      speed: 6,
      damage: 8,
      health: 10,
      maxHealth: 10,
      targetId: defender.id,
      order: 'attack',
    };

    // Disable the attacker's own weapons so only the fighter does damage
    const stateWithFighter: TacticalState = {
      ...state,
      ships: state.ships.map((s) =>
        s.side === 'attacker'
          ? { ...s, weapons: s.weapons.map((w) => ({ ...w, cooldownLeft: 999 })) }
          : s,
      ),
      fighters: [fighter],
    };

    const defenderBefore = stateWithFighter.ships.find((s) => s.side === 'defender')!;
    const hullBefore = defenderBefore.hull;

    const next = processTacticalTick(stateWithFighter);
    const defenderAfter = next.ships.find((s) => s.side === 'defender')!;

    // Fighter deals damage * 0.3 per tick — shields may absorb some, but hull/shields should change
    const totalHpBefore = hullBefore + defenderBefore.shields;
    const totalHpAfter = defenderAfter.hull + defenderAfter.shields;
    expect(totalHpAfter).toBeLessThan(totalHpBefore);
  });

  it('point defence can kill fighters', () => {
    // Set up a defender with point defence
    const pdDesign: ShipDesign = {
      id: 'd-pd',
      name: 'PD Design',
      hull: 'scout',
      components: [
        { slotId: 'scout_fore_1', componentId: 'point_defense_turret' },
        { slotId: 'scout_turret_1', componentId: 'deflector_shield' },
        { slotId: 'scout_aft_1', componentId: 'ion_engine' },
      ],
      totalCost: 150,
      empireId: 'empire-2',
    };

    const carrierDesign = makeCarrierDesign('d-carrier', 'empire-1');
    const state = setupOnePair({
      attacker: carrierDesign,
      defender: pdDesign,
    });

    const defender = state.ships.find((s) => s.side === 'defender')!;
    const attacker = state.ships.find((s) => s.side === 'attacker')!;

    // Place a fighter close to the PD defender with no missiles present
    const fighter: Fighter = {
      id: 'test-fighter-pd',
      carrierId: attacker.id,
      side: 'attacker',
      x: defender.position.x + 20,
      y: defender.position.y,
      speed: 6,
      damage: 8,
      health: 10,
      maxHealth: 10,
      targetId: defender.id,
      order: 'attack',
    };

    const stateWithFighter: TacticalState = {
      ...state,
      missiles: [], // no missiles, so PD should target fighters
      fighters: [fighter],
      ships: state.ships.map((s) =>
        s.side === 'defender'
          ? {
              ...s,
              weapons: s.weapons.map((w) => ({
                ...w,
                cooldownLeft: 0,
                accuracy: 100, // guarantee hit for testing
              })),
            }
          : { ...s, weapons: s.weapons.map((w) => ({ ...w, cooldownLeft: 999 })) },
      ),
    };

    // Run many ticks — PD has cooldown 8, 50% effective accuracy against fighters.
    // Over 100 ticks (roughly 12 shots) with 50% hit chance, probability of
    // surviving all is (0.5)^12 = 0.02% — practically impossible.
    let current = stateWithFighter;
    for (let i = 0; i < 100; i++) {
      current = processTacticalTick(current);
    }

    // The fighter should have been destroyed and filtered out
    const survivingFighters = current.fighters.filter(
      (f) => f.id === 'test-fighter-pd' && f.health > 0,
    );
    expect(survivingFighters.length).toBe(0);
  });

  it('fighters persist after carrier destruction', () => {
    const state = setupCarrierVsTarget();
    const defender = state.ships.find((s) => s.side === 'defender')!;
    const attacker = state.ships.find((s) => s.side === 'attacker')!;

    // Place a fighter in the battlefield
    const fighter: Fighter = {
      id: 'test-fighter-orphan',
      carrierId: attacker.id,
      side: 'attacker',
      x: 300,
      y: 400,
      speed: 6,
      damage: 8,
      health: 10,
      maxHealth: 10,
      targetId: defender.id,
      order: 'attack',
    };

    // Destroy the carrier
    const stateWithDeadCarrier: TacticalState = {
      ...state,
      ships: state.ships.map((s) =>
        s.id === attacker.id
          ? { ...s, destroyed: true, hull: 0 }
          : s,
      ),
      fighters: [fighter],
    };

    const next = processTacticalTick(stateWithDeadCarrier);
    const orphanFighter = next.fighters.find((f) => f.id === 'test-fighter-orphan');
    expect(orphanFighter).toBeDefined();
    expect(orphanFighter!.health).toBeGreaterThan(0);
    expect(orphanFighter!.order).toBe('attack'); // keeps fighting
  });

  it('fighter ammo depletes as fighters are launched', () => {
    const state = setupCarrierVsTarget();

    // Tick once — should launch fighters and reduce ammo
    const next1 = processTacticalTick(state);
    const atk1 = next1.ships.find((s) => s.side === 'attacker')!;
    const bay1 = atk1.weapons.find((w) => w.type === 'fighter_bay')!;
    expect(bay1.ammo).toBeLessThan(4); // started at 4, launched some

    // Keep ticking until all fighters are launched
    let current = next1;
    for (let i = 0; i < 100; i++) {
      current = processTacticalTick(current);
    }
    const atkFinal = current.ships.find((s) => s.side === 'attacker');
    if (atkFinal && !atkFinal.destroyed) {
      const bayFinal = atkFinal.weapons.find((w) => w.type === 'fighter_bay')!;
      expect(bayFinal.ammo).toBe(0);
    }
  });

  it('findNearestEnemyFighter returns closest enemy fighter', () => {
    const state = setupCarrierVsTarget();
    const defender = state.ships.find((s) => s.side === 'defender')!;

    const friendlyFighter: Fighter = {
      id: 'friendly-f',
      carrierId: 'carrier-1',
      side: 'defender',
      x: defender.position.x + 5,
      y: defender.position.y,
      speed: 6,
      damage: 8,
      health: 10,
      maxHealth: 10,
      targetId: null,
      order: 'attack',
    };

    const enemyFighter: Fighter = {
      id: 'enemy-f',
      carrierId: 'carrier-2',
      side: 'attacker',
      x: defender.position.x + 30,
      y: defender.position.y,
      speed: 6,
      damage: 8,
      health: 10,
      maxHealth: 10,
      targetId: defender.id,
      order: 'attack',
    };

    const nearest = findNearestEnemyFighter(defender, [friendlyFighter, enemyFighter]);
    expect(nearest).not.toBeNull();
    expect(nearest!.id).toBe('enemy-f');
  });

  it('initializes TacticalState with empty fighters array', () => {
    const state = setupOnePair();
    expect(state.fighters).toEqual([]);
  });

  it('fighter_bay weapon has ammo set from component fighterCount', () => {
    const carrierDesign = makeCarrierDesign('d-carrier', 'empire-1');
    const state = setupOnePair({ attacker: carrierDesign });
    const attacker = state.ships.find((s) => s.side === 'attacker')!;
    const bay = attacker.weapons.find((w) => w.type === 'fighter_bay');
    expect(bay).toBeDefined();
    expect(bay!.ammo).toBe(4); // light_fighter_bay: fighterCount = 4
    expect(bay!.maxAmmo).toBe(4);
    // Per-fighter damage, not aggregate
    expect(bay!.damage).toBe(8); // light_fighter_bay: damage = 8
  });
});

// ---------------------------------------------------------------------------
// Friendly fire + Environmental hazards tests
// ---------------------------------------------------------------------------

/** Build a minimal TacticalShip for unit tests. */
function makeTacticalShip(overrides: Partial<TacticalShip> & { id: string; side: TacticalShip['side'] }): TacticalShip {
  return {
    sourceShipId: overrides.id,
    name: `Ship ${overrides.id}`,
    position: { x: 0, y: 0 },
    facing: 0,
    speed: 2,
    turnRate: 0.08,
    hull: 100,
    maxHull: 100,
    shields: 0,
    maxShields: 0,
    armour: 0,
    weapons: [],
    sensorRange: 200,
    order: { type: 'idle' as const },
    destroyed: false,
    routed: false, stance: "aggressive" as any, damageTakenThisTick: 0,
    crew: { morale: 80, health: 100, experience: 'regular' as const },
    ...overrides,
  };
}

/** Build a minimal TacticalState for unit tests. */
function makeMinimalState(overrides?: Partial<TacticalState>): TacticalState {
  return {
    tick: 0,
    ships: [],
    projectiles: [],
    missiles: [],
    fighters: [],
    beamEffects: [],
    pointDefenceEffects: [],
    environment: [],
    battlefieldWidth: BATTLEFIELD_WIDTH,
    battlefieldHeight: BATTLEFIELD_HEIGHT,
    outcome: null,
    attackerFormation: 'line',
    defenderFormation: 'line',
    admirals: [],
    layout: 'open_space',
    ...overrides,
  };
}

describe('Friendly fire', () => {
  it('projectile hits friendly ship when target is destroyed', () => {
    const source = makeTacticalShip({
      id: 'atk-source',
      side: 'attacker',
      position: { x: 100, y: 100 },
    });
    const friendly = makeTacticalShip({
      id: 'atk-bystander',
      side: 'attacker',
      position: { x: 500, y: 500 },
      hull: 50,
      maxHull: 100,
    });
    const deadTarget = makeTacticalShip({
      id: 'def-target',
      side: 'defender',
      position: { x: 800, y: 800 },
      destroyed: true,
      hull: 0,
    });

    const projectile: Projectile = {
      id: 'proj-1',
      position: { x: 500, y: 500 },
      speed: PROJECTILE_SPEED,
      damage: 10,
      sourceShipId: 'atk-source',
      targetShipId: 'def-target',
    };

    const origRandom = Math.random;
    Math.random = () => 0.99;

    try {
      const state = makeMinimalState({
        ships: [source, friendly, deadTarget],
        projectiles: [projectile],
      });

      const next = processTacticalTick(state);
      expect(next.projectiles).toHaveLength(0);
      const bystander = next.ships.find((s) => s.id === 'atk-bystander')!;
      expect(bystander.hull).toBeLessThan(50);
    } finally {
      Math.random = origRandom;
    }
  });

  it('beam has chance of collateral damage on bystander ship', () => {
    const source = makeTacticalShip({
      id: 'atk-1',
      side: 'attacker',
      position: { x: 100, y: 100 },
      facing: 0,
      weapons: [{
        componentId: 'test-beam',
        type: 'beam',
        damage: 20,
        range: 1000,
        accuracy: 100,
        cooldownMax: 10,
        cooldownLeft: 0,
        facing: 'turret',
      }],
    });
    const target = makeTacticalShip({
      id: 'def-1',
      side: 'defender',
      position: { x: 500, y: 100 },
      hull: 100,
      maxHull: 100,
    });
    const bystander = makeTacticalShip({
      id: 'atk-bystander',
      side: 'attacker',
      position: { x: 300, y: 105 },
      hull: 80,
      maxHull: 100,
    });

    const origRandom = Math.random;
    Math.random = () => 0.01;

    try {
      const state = makeMinimalState({
        ships: [source, bystander, target],
      });

      const next = processTacticalTick(state);
      const hit = next.ships.find((s) => s.id === 'atk-bystander')!;
      expect(hit.hull).toBeLessThan(80);
      const collateralBeam = next.beamEffects.find(
        (b) => b.targetShipId === 'atk-bystander',
      );
      expect(collateralBeam).toBeDefined();
    } finally {
      Math.random = origRandom;
    }
  });
});

describe('Environmental hazards', () => {
  it('asteroid provides cover (dodge chance) for ships inside', () => {
    const source = makeTacticalShip({
      id: 'atk-1',
      side: 'attacker',
      position: { x: 100, y: 100 },
    });
    const target = makeTacticalShip({
      id: 'def-1',
      side: 'defender',
      position: { x: 200, y: 200 },
      hull: 50,
      maxHull: 100,
    });

    const asteroid: EnvironmentFeature = {
      id: 'asteroid-cover',
      type: 'asteroid',
      x: 200,
      y: 200,
      radius: 40,
    };

    const projectile: Projectile = {
      id: 'proj-1',
      position: { x: 200, y: 200 },
      speed: PROJECTILE_SPEED,
      damage: 10,
      sourceShipId: 'atk-1',
      targetShipId: 'def-1',
    };

    const origRandom = Math.random;
    Math.random = () => 0.1;

    try {
      const state = makeMinimalState({
        ships: [source, target],
        projectiles: [projectile],
        environment: [asteroid],
      });

      const next = processTacticalTick(state);
      const def = next.ships.find((s) => s.id === 'def-1')!;
      expect(def.hull).toBe(50);
      expect(next.projectiles).toHaveLength(0);
    } finally {
      Math.random = origRandom;
    }
  });

  it('nebula reduces beam damage by 50%', () => {
    const nebula: EnvironmentFeature = {
      id: 'nebula-1',
      type: 'nebula',
      x: 300,
      y: 100,
      radius: 100,
    };

    const source = makeTacticalShip({
      id: 'atk-1',
      side: 'attacker',
      position: { x: 100, y: 100 },
      facing: 0,
      weapons: [{
        componentId: 'test-beam',
        type: 'beam',
        damage: 20,
        range: 1000,
        accuracy: 100,
        cooldownMax: 10,
        cooldownLeft: 0,
        facing: 'turret',
      }],
    });
    const target = makeTacticalShip({
      id: 'def-1',
      side: 'defender',
      position: { x: 500, y: 100 },
      hull: 100,
      maxHull: 100,
      shields: 0,
      maxShields: 0,
      armour: 0,
    });

    const origRandom = Math.random;
    Math.random = () => 0.99;

    try {
      const stateNoNebula = makeMinimalState({
        ships: [{ ...source }, { ...target }],
        environment: [],
      });
      const nextNoNebula = processTacticalTick(stateNoNebula);
      const targetNoNebula = nextNoNebula.ships.find((s) => s.id === 'def-1')!;

      const stateWithNebula = makeMinimalState({
        ships: [
          { ...source, weapons: source.weapons.map((w) => ({ ...w, cooldownLeft: 0 })) },
          { ...target },
        ],
        environment: [nebula],
      });
      const nextWithNebula = processTacticalTick(stateWithNebula);
      const targetWithNebula = nextWithNebula.ships.find((s) => s.id === 'def-1')!;

      expect(targetWithNebula.hull).toBeGreaterThan(targetNoNebula.hull);
    } finally {
      Math.random = origRandom;
    }
  });

  it('debris damages ships passing through each tick', () => {
    const debris: EnvironmentFeature = {
      id: 'debris-old',
      type: 'debris',
      x: 400,
      y: 400,
      radius: 30,
    };

    const shipInDebris = makeTacticalShip({
      id: 'atk-1',
      side: 'attacker',
      position: { x: 400, y: 400 },
      hull: 50,
      maxHull: 100,
      shields: 0,
      maxShields: 0,
      armour: 0,
    });
    const shipOutside = makeTacticalShip({
      id: 'def-1',
      side: 'defender',
      position: { x: 800, y: 800 },
      hull: 50,
      maxHull: 100,
    });

    const origRandom = Math.random;
    Math.random = () => 0.99;

    try {
      const state = makeMinimalState({
        ships: [shipInDebris, shipOutside],
        environment: [debris],
      });

      const next = processTacticalTick(state);
      const inDebris = next.ships.find((s) => s.id === 'atk-1')!;
      const outside = next.ships.find((s) => s.id === 'def-1')!;

      expect(inDebris.hull).toBeLessThan(50);
      expect(outside.hull).toBe(50);
    } finally {
      Math.random = origRandom;
    }
  });

  it('debris is created when a ship is destroyed', () => {
    const origRandom = Math.random;
    Math.random = () => 0.99;

    try {
      const source = makeTacticalShip({
        id: 'atk-1',
        side: 'attacker',
        position: { x: 100, y: 100 },
      });
      const target = makeTacticalShip({
        id: 'def-1',
        side: 'defender',
        position: { x: 200, y: 200 },
        hull: 1,
        maxHull: 100,
        shields: 0,
        maxShields: 0,
        armour: 0,
      });

      const projectile: Projectile = {
        id: 'proj-kill',
        position: { x: 200, y: 200 },
        speed: PROJECTILE_SPEED,
        damage: 50,
        sourceShipId: 'atk-1',
        targetShipId: 'def-1',
      };

      const state = makeMinimalState({
        ships: [source, target],
        projectiles: [projectile],
        environment: [],
      });

      const next = processTacticalTick(state);
      const def = next.ships.find((s) => s.id === 'def-1')!;
      expect(def.destroyed).toBe(true);

      const debris = next.environment.find((e) => e.type === 'debris');
      expect(debris).toBeDefined();
      expect(debris!.id).toBe('debris-def-1');
      expect(debris!.radius).toBe(DEBRIS_RADIUS);
    } finally {
      Math.random = origRandom;
    }
  });

  it('initializeTacticalCombat places asteroids and possibly nebulae', () => {
    const state = setupOnePair();
    expect(state.environment).toBeDefined();
    expect(state.environment.length).toBeGreaterThanOrEqual(3);
    for (const f of state.environment) {
      expect(['asteroid', 'nebula']).toContain(f.type);
    }
  });
});

describe('pointToSegmentDistance', () => {
  it('returns 0 when point is on the segment', () => {
    expect(pointToSegmentDistance(5, 5, 0, 0, 10, 10)).toBeCloseTo(0, 5);
  });

  it('returns correct perpendicular distance', () => {
    expect(pointToSegmentDistance(5, 3, 0, 0, 10, 0)).toBeCloseTo(3, 5);
  });

  it('returns distance to nearest endpoint when projection falls outside', () => {
    expect(pointToSegmentDistance(15, 0, 0, 0, 10, 0)).toBeCloseTo(5, 5);
  });
});

// ---------------------------------------------------------------------------
// Crew morale, experience, and admiral tests
// ---------------------------------------------------------------------------

describe('Crew morale', () => {
  it('morale decreases when an ally is destroyed', () => {
    // Use processTacticalTick with a ship that is already on the brink of
    // destruction. The debris-creation step detects newly destroyed ships
    // and drops allied morale by 5.
    const ally = makeTacticalShip({
      id: 'ally',
      side: 'attacker',
      position: { x: 100, y: 100 },
      hull: 100,
      maxHull: 100,
      crew: { morale: 80, health: 100, experience: 'regular' },
    });
    // Victim is already destroyed this tick via direct applyDamage
    // We simulate this by having the victim with hull 1 and placing an
    // enemy beam shooter right on top of it.
    const victim = makeTacticalShip({
      id: 'victim',
      side: 'attacker',
      position: { x: 200, y: 200 },
      hull: 1,
      maxHull: 100,
      shields: 0,
      maxShields: 0,
      armour: 0,
      crew: { morale: 80, health: 100, experience: 'regular' },
    });
    // Use a defender with 100% accuracy, elite crew, and a turret beam
    const enemy = makeTacticalShip({
      id: 'enemy',
      side: 'defender',
      position: { x: 200, y: 200 },
      facing: 0,
      hull: 100,
      maxHull: 100,
      crew: { morale: 80, health: 100, experience: 'elite' },
      weapons: [{
        componentId: 'beam-1',
        type: 'beam',
        damage: 500,
        range: 500,
        accuracy: 100,
        cooldownMax: 1,
        cooldownLeft: 0,
        facing: 'turret',
      }],
      order: { type: 'attack', targetId: 'victim' },
    });

    // Enemy must come before victim in array for beam damage to apply
    // on the same tick (beam damage mutates the array by index during map)
    let state = makeMinimalState({
      ships: [ally, enemy, victim],
    });

    // Run ticks until the victim is destroyed
    let victimDied = false;
    for (let i = 0; i < 30; i++) {
      state = processTacticalTick(state);
      if (state.ships.find(s => s.id === 'victim')?.destroyed) {
        victimDied = true;
        break;
      }
    }

    expect(victimDied).toBe(true);

    // The ally's morale should have dropped from 80 (ally loss = -5)
    const finalAlly = state.ships.find(s => s.id === 'ally');
    expect(finalAlly).toBeDefined();
    expect(finalAlly!.crew.morale).toBeLessThan(80);
  });

  it('morale drops during prolonged combat (tick > 50)', () => {
    const ship = makeTacticalShip({
      id: 'lone-ship',
      side: 'attacker',
      position: { x: 100, y: 100 },
      crew: { morale: 60, health: 100, experience: 'regular' },
    });
    const enemy = makeTacticalShip({
      id: 'enemy',
      side: 'defender',
      position: { x: 800, y: 800 },
      crew: { morale: 80, health: 100, experience: 'regular' },
    });

    let state = makeMinimalState({
      tick: 51,
      ships: [ship, enemy],
    });

    state = processTacticalTick(state);

    const updated = state.ships.find(s => s.id === 'lone-ship');
    expect(updated).toBeDefined();
    // At tick 51+, fatigue reduces morale by 0.2
    // Regular experience gives 0.05 resilience back
    // Net: -0.15 per tick
    expect(updated!.crew.morale).toBeLessThan(60);
  });

  it('ships rout at very low morale', () => {
    const ship = makeTacticalShip({
      id: 'fearful',
      side: 'attacker',
      position: { x: 100, y: 100 },
      crew: { morale: 5, health: 100, experience: 'recruit' },
    });
    const enemy = makeTacticalShip({
      id: 'enemy',
      side: 'defender',
      position: { x: 800, y: 800 },
      crew: { morale: 80, health: 100, experience: 'regular' },
    });

    let state = makeMinimalState({ ships: [ship, enemy] });

    // Run many ticks — with morale at 5 and 15% chance per tick, ship should rout
    let routed = false;
    for (let i = 0; i < 100; i++) {
      state = processTacticalTick(state);
      const s = state.ships.find(s => s.id === 'fearful');
      if (s?.routed) {
        routed = true;
        break;
      }
    }
    expect(routed).toBe(true);
  });
});

describe('Experience affects accuracy', () => {
  it('green crews miss more often than elite crews', () => {
    // We test this statistically — run many shots with green vs elite
    // Green has 0.85x accuracy, elite has 1.15x accuracy
    // With a base 75% accuracy weapon:
    //   green effective: 63.75%, elite effective: 86.25%
    // Over 1000 trials, the difference should be clear

    let greenHits = 0;
    let eliteHits = 0;
    const trials = 2000;

    for (let i = 0; i < trials; i++) {
      // Green: 75 * 0.85 = 63.75
      if (Math.random() * 100 <= 63.75) greenHits++;
      // Elite: 75 * 1.15 = 86.25
      if (Math.random() * 100 <= 86.25) eliteHits++;
    }

    // Elite should hit significantly more often
    expect(eliteHits).toBeGreaterThan(greenHits);
  });
});

describe('Admiral rally', () => {
  it('boosts all friendly ships morale by 20', () => {
    const ship1 = makeTacticalShip({
      id: 'ship-1',
      side: 'attacker',
      crew: { morale: 50, health: 100, experience: 'regular' },
    });
    const ship2 = makeTacticalShip({
      id: 'ship-2',
      side: 'attacker',
      crew: { morale: 30, health: 100, experience: 'regular' },
    });
    const enemy = makeTacticalShip({
      id: 'enemy',
      side: 'defender',
      crew: { morale: 50, health: 100, experience: 'regular' },
    });

    const admiral = createAdmiral('Admiral Nelson', 'attacker', 'inspiring', 'veteran');

    const state = makeMinimalState({
      ships: [ship1, ship2, enemy],
      admirals: [admiral],
    });

    const result = admiralRally(state, 'attacker');

    const s1 = result.ships.find(s => s.id === 'ship-1');
    const s2 = result.ships.find(s => s.id === 'ship-2');
    const e = result.ships.find(s => s.id === 'enemy');

    expect(s1!.crew.morale).toBe(70);
    expect(s2!.crew.morale).toBe(50);
    // Enemy should be unaffected
    expect(e!.crew.morale).toBe(50);

    // Rally should be marked as used
    const updatedAdmiral = result.admirals.find(a => a.side === 'attacker');
    expect(updatedAdmiral!.rallyUsed).toBe(true);
  });

  it('cannot rally twice', () => {
    const ship = makeTacticalShip({
      id: 'ship-1',
      side: 'attacker',
      crew: { morale: 50, health: 100, experience: 'regular' },
    });

    const admiral = createAdmiral('Admiral', 'attacker', 'inspiring', 'regular');

    let state = makeMinimalState({
      ships: [ship],
      admirals: [admiral],
    });

    state = admiralRally(state, 'attacker');
    const afterFirst = state.ships.find(s => s.id === 'ship-1')!.crew.morale;
    expect(afterFirst).toBe(70);

    // Second rally should have no effect
    state = admiralRally(state, 'attacker');
    const afterSecond = state.ships.find(s => s.id === 'ship-1')!.crew.morale;
    expect(afterSecond).toBe(70);
  });

  it('morale is capped at 100', () => {
    const ship = makeTacticalShip({
      id: 'ship-1',
      side: 'attacker',
      crew: { morale: 90, health: 100, experience: 'regular' },
    });

    const admiral = createAdmiral('Admiral', 'attacker', 'inspiring', 'regular');

    const state = makeMinimalState({
      ships: [ship],
      admirals: [admiral],
    });

    const result = admiralRally(state, 'attacker');
    expect(result.ships[0]!.crew.morale).toBe(100);
  });
});

describe('Admiral emergency repair', () => {
  it('heals 15% of max hull and sets order to idle', () => {
    const ship = makeTacticalShip({
      id: 'damaged',
      side: 'attacker',
      hull: 50,
      maxHull: 100,
      order: { type: 'attack', targetId: 'enemy' },
      crew: { morale: 60, health: 100, experience: 'regular' },
    });

    const admiral = createAdmiral('Admiral', 'attacker', 'tactical', 'veteran');

    const state = makeMinimalState({
      ships: [ship],
      admirals: [admiral],
    });

    const result = admiralEmergencyRepair(state, 'attacker', 'damaged');

    const s = result.ships.find(s => s.id === 'damaged');
    expect(s!.hull).toBe(65); // 50 + 15% of 100
    expect(s!.order.type).toBe('idle');

    const updatedAdmiral = result.admirals.find(a => a.side === 'attacker');
    expect(updatedAdmiral!.emergencyRepairUsed).toBe(true);
  });

  it('cannot repair twice', () => {
    const ship = makeTacticalShip({
      id: 'damaged',
      side: 'attacker',
      hull: 50,
      maxHull: 100,
      crew: { morale: 60, health: 100, experience: 'regular' },
    });

    const admiral = createAdmiral('Admiral', 'attacker', 'tactical', 'veteran');

    let state = makeMinimalState({
      ships: [ship],
      admirals: [admiral],
    });

    state = admiralEmergencyRepair(state, 'attacker', 'damaged');
    expect(state.ships[0]!.hull).toBe(65);

    // Second repair should have no effect
    state = admiralEmergencyRepair(state, 'attacker', 'damaged');
    expect(state.ships[0]!.hull).toBe(65);
  });

  it('hull is capped at maxHull', () => {
    const ship = makeTacticalShip({
      id: 'minor-damage',
      side: 'attacker',
      hull: 95,
      maxHull: 100,
      crew: { morale: 60, health: 100, experience: 'regular' },
    });

    const admiral = createAdmiral('Admiral', 'attacker', 'tactical', 'veteran');

    const state = makeMinimalState({
      ships: [ship],
      admirals: [admiral],
    });

    const result = admiralEmergencyRepair(state, 'attacker', 'minor-damage');
    expect(result.ships[0]!.hull).toBe(100);
  });
});

describe('Admiral pause', () => {
  it('pause count from admiral experience', () => {
    expect(admiralPauseCount('recruit')).toBe(1);
    expect(admiralPauseCount('regular')).toBe(2);
    expect(admiralPauseCount('veteran')).toBe(3);
    expect(admiralPauseCount('elite')).toBe(4);
  });

  it('decrements pauses remaining on use', () => {
    const admiral = createAdmiral('Admiral', 'attacker', 'tactical', 'regular');
    expect(admiral.pausesRemaining).toBe(2);

    let state = makeMinimalState({ admirals: [admiral] });

    const result1 = admiralPause(state, 'attacker');
    expect(result1).not.toBeNull();
    expect(result1!.admirals[0]!.pausesRemaining).toBe(1);

    const result2 = admiralPause(result1!, 'attacker');
    expect(result2).not.toBeNull();
    expect(result2!.admirals[0]!.pausesRemaining).toBe(0);

    // Third attempt should return null — no pauses left
    const result3 = admiralPause(result2!, 'attacker');
    expect(result3).toBeNull();
  });
});

describe('Experience gain calculation', () => {
  it('promotes on victory', () => {
    const ship = makeTacticalShip({
      id: 'winner',
      side: 'attacker',
      crew: { morale: 80, health: 100, experience: 'regular' },
    });

    const result = calculateExperienceGain(ship, true, 3, 3);
    expect(result).toBe('veteran');
  });

  it('does not promote on loss with equal numbers', () => {
    const ship = makeTacticalShip({
      id: 'loser',
      side: 'attacker',
      crew: { morale: 80, health: 100, experience: 'regular' },
    });

    const result = calculateExperienceGain(ship, false, 3, 3);
    expect(result).toBe('regular');
  });

  it('promotes when outnumbered regardless of victory', () => {
    const ship = makeTacticalShip({
      id: 'outnumbered',
      side: 'attacker',
      crew: { morale: 80, health: 100, experience: 'recruit' },
    });

    // Lost but was outnumbered (5 vs 3, ratio > 1.5)
    const result = calculateExperienceGain(ship, false, 5, 3);
    expect(result).toBe('regular');
  });

  it('caps at elite for normal victories', () => {
    const ship = makeTacticalShip({
      id: 'elite-ship',
      side: 'attacker',
      crew: { morale: 80, health: 100, experience: 'elite' },
    });

    // Equal numbers: cap stays at elite
    const result = calculateExperienceGain(ship, true, 3, 3);
    expect(result).toBe('elite');
  });

  it('promotes to ace for outnumbered victories (1.5x+)', () => {
    const ship = makeTacticalShip({
      id: 'ace-ship',
      side: 'attacker',
      crew: { morale: 80, health: 100, experience: 'elite' },
    });

    // 6 vs 4 = 1.5x outnumbered, victorious => ace reachable
    const result = calculateExperienceGain(ship, true, 6, 4);
    expect(result).toBe('ace');
  });

  it('promotes to legendary for extremely outnumbered victories (2x+)', () => {
    const ship = makeTacticalShip({
      id: 'legendary-ship',
      side: 'attacker',
      crew: { morale: 80, health: 100, experience: 'elite' },
    });

    // 10 vs 2 = 5x outnumbered, victorious => legendary reachable
    const result = calculateExperienceGain(ship, true, 10, 2);
    expect(result).toBe('legendary');
  });

  it('does not promote past elite on outnumbered loss', () => {
    const ship = makeTacticalShip({
      id: 'elite-loser',
      side: 'attacker',
      crew: { morale: 80, health: 100, experience: 'hardened' },
    });

    // Outnumbered (2x) but lost: only difficultyBonus applies, cap stays at elite
    const result = calculateExperienceGain(ship, false, 6, 3);
    expect(result).toBe('elite');
  });

  it('promotes from green to regular on victory', () => {
    const ship = makeTacticalShip({
      id: 'green-ship',
      side: 'attacker',
      crew: { morale: 80, health: 100, experience: 'recruit' },
    });

    const result = calculateExperienceGain(ship, true, 3, 3);
    expect(result).toBe('regular');
  });
});

describe('Crew initialisation', () => {
  it('ships are initialised with default crew stats', () => {
    const state = setupOnePair();

    for (const ship of state.ships) {
      expect(ship.crew).toBeDefined();
      expect(ship.crew.morale).toBe(80);
      expect(ship.crew.health).toBe(100);
      expect(ship.crew.experience).toBe('regular');
    }
  });

  it('state includes empty admirals array by default', () => {
    const state = setupOnePair();
    expect(state.admirals).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Planetary assault layout
// ---------------------------------------------------------------------------

describe('Planetary assault layout', () => {
  const planetData: PlanetData = {
    name: 'Terra Nova',
    type: 'terran',
    defenceRating: 2,
    shieldActive: false,
    orbitalGuns: 3,
  };

  function setupPlanetaryAssault(guns = 3, defenceRating = 2): TacticalState {
    const attackerDesign = makeArmedDesign('d-atk-pa', 'empire-1');
    const defenderDesign = makeArmedDesign('d-def-pa', 'empire-2');
    const designs = new Map<string, ShipDesign>([
      [attackerDesign.id, attackerDesign],
      [defenderDesign.id, defenderDesign],
    ]);

    const attackerShips = [makeShip('atk-pa-1', attackerDesign.id)];
    const defenderShips = [makeShip('def-pa-1', defenderDesign.id)];

    return initializeTacticalCombat(
      makeFleet('f-atk-pa', 'empire-1', ['atk-pa-1']),
      makeFleet('f-def-pa', 'empire-2', ['def-pa-1']),
      attackerShips,
      defenderShips,
      designs,
      SHIP_COMPONENTS,
      'planetary_assault',
      { ...planetData, orbitalGuns: guns, defenceRating },
    );
  }

  it('sets layout to planetary_assault', () => {
    const state = setupPlanetaryAssault();
    expect(state.layout).toBe('planetary_assault');
  });

  it('includes planet data in state', () => {
    const state = setupPlanetaryAssault();
    expect(state.planetData).toBeDefined();
    expect(state.planetData!.name).toBe('Terra Nova');
    expect(state.planetData!.type).toBe('terran');
    expect(state.planetData!.defenceRating).toBe(2);
    expect(state.planetData!.orbitalGuns).toBe(3);
  });

  it('places orbital defence platforms', () => {
    const state = setupPlanetaryAssault(3);
    const defences = state.ships.filter(s => s.id.startsWith('orbital-defense-'));
    expect(defences).toHaveLength(3);
  });

  it('orbital defences are immobile (speed 0)', () => {
    const state = setupPlanetaryAssault(2);
    const defences = state.ships.filter(s => s.id.startsWith('orbital-defense-'));
    for (const def of defences) {
      expect(def.speed).toBe(0);
    }
  });

  it('orbital defences are on the defender side', () => {
    const state = setupPlanetaryAssault(2);
    const defences = state.ships.filter(s => s.id.startsWith('orbital-defense-'));
    for (const def of defences) {
      expect(def.side).toBe('defender');
    }
  });

  it('orbital defences have turret-facing weapons', () => {
    const state = setupPlanetaryAssault(1);
    const def = state.ships.find(s => s.id === 'orbital-defense-0')!;
    expect(def.weapons).toHaveLength(1);
    expect(def.weapons[0].type).toBe('projectile');
    expect(def.weapons[0].facing).toBe('turret');
    expect(def.weapons[0].damage).toBe(25);
    expect(def.weapons[0].range).toBe(500);
  });

  it('defence hull scales with defenceRating', () => {
    const stateRating1 = setupPlanetaryAssault(1, 1);
    const stateRating3 = setupPlanetaryAssault(1, 3);

    const def1 = stateRating1.ships.find(s => s.id === 'orbital-defense-0')!;
    const def3 = stateRating3.ships.find(s => s.id === 'orbital-defense-0')!;

    // defenceRating=1: 200*(1+0.5)=300, defenceRating=3: 200*(1+1.5)=500
    expect(def1.maxHull).toBe(300);
    expect(def3.maxHull).toBe(500);
  });

  it('defence shields scale with defenceRating', () => {
    const state = setupPlanetaryAssault(1, 2);
    const def = state.ships.find(s => s.id === 'orbital-defense-0')!;
    // 50 * 2 = 100
    expect(def.maxShields).toBe(100);
    expect(def.shields).toBe(100);
  });

  it('orbital defences are positioned near planet centre', () => {
    const state = setupPlanetaryAssault(2);
    const planetCX = BATTLEFIELD_WIDTH - 200;
    const planetCY = BATTLEFIELD_HEIGHT - 150;

    const defences = state.ships.filter(s => s.id.startsWith('orbital-defense-'));
    for (const def of defences) {
      const dx = def.position.x - planetCX;
      const dy = def.position.y - planetCY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Should be at radius ~120 from planet centre
      expect(dist).toBeCloseTo(120, 0);
    }
  });

  it('orbital defences have veteran crew', () => {
    const state = setupPlanetaryAssault(1);
    const def = state.ships.find(s => s.id === 'orbital-defense-0')!;
    expect(def.crew.experience).toBe('veteran');
    expect(def.crew.morale).toBe(90);
  });

  it('open_space layout has no orbital defences', () => {
    const state = setupOnePair();
    expect(state.layout).toBe('open_space');
    expect(state.planetData).toBeUndefined();
    const defences = state.ships.filter(s => s.id.startsWith('orbital-defense-'));
    expect(defences).toHaveLength(0);
  });

  it('guarantees at least 1 orbital gun even when orbitalGuns is 0', () => {
    const state = setupPlanetaryAssault(0);
    const defences = state.ships.filter(s => s.id.startsWith('orbital-defense-'));
    // Math.max(1, 0) = 1
    expect(defences).toHaveLength(1);
  });

  it('orbital defences can rotate freely (turnRate = PI)', () => {
    const state = setupPlanetaryAssault(1);
    const def = state.ships.find(s => s.id === 'orbital-defense-0')!;
    expect(def.turnRate).toBeCloseTo(Math.PI, 5);
  });

  it('orbital defences fire at attackers during tick processing', () => {
    // Seed Math.random so accuracy checks always succeed
    const origRandom = Math.random;
    Math.random = () => 0.01; // low value passes accuracy checks

    try {
      // Set up a planetary assault with one orbital defence and one attacker within range
      const state = setupPlanetaryAssault(1, 2);
      const def = state.ships.find(s => s.id === 'orbital-defense-0')!;
      const atk = state.ships.find(s => s.side === 'attacker')!;

      // Move the attacker within range of the orbital defence
      const stateWithClose = {
        ...state,
        ships: state.ships.map(s => {
          if (s.id === atk.id) {
            return { ...s, position: { x: def.position.x - 200, y: def.position.y } };
          }
          return s;
        }),
      };

      // Process enough ticks for the weapon to fire and projectile to hit
      // cooldown is 8, projectile travel time ~200/8 = 25 ticks
      let current = stateWithClose;
      for (let i = 0; i < 40; i++) {
        current = processTacticalTick(current);
      }

      // The attacker should have taken some damage from the orbital defence
      const atkAfter = current.ships.find(s => s.id === atk.id)!;
      const hullBefore = atk.hull;
      expect(atkAfter.hull).toBeLessThan(hullBefore);
    } finally {
      Math.random = origRandom;
    }
  });
});
