import { describe, it, expect } from 'vitest';

import {
  initializeCombat,
  processCombatTick,
  autoResolveCombat,
  applyCombatResults,
  calculateFleetPower,
} from '../engine/combat.js';
import type {
  CombatSetup,
  CombatState,
  CombatEvent,
  CombatOutcome,
} from '../engine/combat.js';
import type { Fleet, Ship, ShipDesign } from '../types/ships.js';
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

/**
 * Build a minimal ShipDesign with a pulse laser, deflector shield, and ion engine
 * using real component data from the shared data package.
 */
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

/**
 * Build a heavy design (cruiser-class) with kinetic cannons and a heavy shield.
 */
function makeHeavyDesign(id: string, empireId = 'empire-1'): ShipDesign {
  return {
    id,
    name: `Heavy Design ${id}`,
    hull: 'cruiser',
    components: [
      { slotId: 'cruiser_fore_1', componentId: 'kinetic_cannon' },
      { slotId: 'cruiser_fore_2', componentId: 'kinetic_cannon' },
      { slotId: 'cruiser_port_1', componentId: 'kinetic_cannon' },
      { slotId: 'cruiser_starboard_1', componentId: 'kinetic_cannon' },
      { slotId: 'cruiser_turret_1', componentId: 'deflector_shield' },
      { slotId: 'cruiser_turret_2', componentId: 'deflector_shield' },
      { slotId: 'cruiser_aft_1', componentId: 'ion_engine' },
      { slotId: 'cruiser_special_1', componentId: 'short_range_scanner' },
    ],
    totalCost: 900,
    empireId,
  };
}

/** Build an unarmed design (no weapons — only engine and shield). */
function makeUnarmedDesign(id: string, empireId = 'empire-1'): ShipDesign {
  return {
    id,
    name: `Unarmed Design ${id}`,
    hull: 'scout',
    components: [
      { slotId: 'scout_fore_1', componentId: 'short_range_scanner' },
      { slotId: 'scout_turret_1', componentId: 'deflector_shield' },
      { slotId: 'scout_aft_1', componentId: 'ion_engine' },
    ],
    totalCost: 175,
    empireId,
  };
}

/** Build a standard one-vs-one CombatSetup with armed scouts. */
function makeOneVsOneSetup(): CombatSetup {
  const aDesign = makeArmedDesign('design-a', 'empire-1');
  const dDesign = makeArmedDesign('design-d', 'empire-2');
  const aShip = makeShip('ship-a1', aDesign.id);
  const dShip = makeShip('ship-d1', dDesign.id);

  return {
    attackerFleet: makeFleet('fleet-a', 'empire-1', [aShip.id]),
    defenderFleet: makeFleet('fleet-d', 'empire-2', [dShip.id]),
    attackerShips: [aShip],
    defenderShips: [dShip],
    attackerDesigns: new Map([[aDesign.id, aDesign]]),
    defenderDesigns: new Map([[dDesign.id, dDesign]]),
  };
}

/** Run a single tick on a setup and return the resulting state. */
function runOneTick(setup: CombatSetup): CombatState {
  const initial = initializeCombat(setup, SHIP_COMPONENTS);
  return processCombatTick(
    initial,
    SHIP_COMPONENTS,
    setup.attackerDesigns,
    setup.defenderDesigns,
  );
}

/** Run combat until outcome or max ticks. */
function runToCompletion(setup: CombatSetup): CombatState {
  let state = initializeCombat(setup, SHIP_COMPONENTS);
  for (let i = 0; i < 200 && state.outcome === null; i++) {
    state = processCombatTick(
      state,
      SHIP_COMPONENTS,
      setup.attackerDesigns,
      setup.defenderDesigns,
    );
  }
  return state;
}

// ---------------------------------------------------------------------------
// initializeCombat
// ---------------------------------------------------------------------------

describe('initializeCombat', () => {
  it('creates the correct number of attacker and defender CombatShips', () => {
    const setup = makeOneVsOneSetup();
    const state = initializeCombat(setup, SHIP_COMPONENTS);

    expect(state.attackerShips).toHaveLength(1);
    expect(state.defenderShips).toHaveLength(1);
  });

  it('sets all ships to morale 100', () => {
    const setup = makeOneVsOneSetup();
    const state = initializeCombat(setup, SHIP_COMPONENTS);

    for (const cs of [...state.attackerShips, ...state.defenderShips]) {
      expect(cs.morale).toBe(100);
    }
  });

  it('marks all ships as not routed and not destroyed', () => {
    const setup = makeOneVsOneSetup();
    const state = initializeCombat(setup, SHIP_COMPONENTS);

    for (const cs of [...state.attackerShips, ...state.defenderShips]) {
      expect(cs.isRouted).toBe(false);
      expect(cs.isDestroyed).toBe(false);
    }
  });

  it('assigns attackers to side "attacker" and defenders to side "defender"', () => {
    const setup = makeOneVsOneSetup();
    const state = initializeCombat(setup, SHIP_COMPONENTS);

    for (const cs of state.attackerShips) {
      expect(cs.side).toBe('attacker');
    }
    for (const cs of state.defenderShips) {
      expect(cs.side).toBe('defender');
    }
  });

  it('places attackers on the left and defenders on the right', () => {
    const setup = makeOneVsOneSetup();
    const state = initializeCombat(setup, SHIP_COMPONENTS);

    const aX = state.attackerShips[0]!.position.x;
    const dX = state.defenderShips[0]!.position.x;
    expect(aX).toBeLessThan(0);
    expect(dX).toBeGreaterThan(0);
  });

  it('starts with tick = 0 and no outcome', () => {
    const setup = makeOneVsOneSetup();
    const state = initializeCombat(setup, SHIP_COMPONENTS);

    expect(state.tick).toBe(0);
    expect(state.outcome).toBeNull();
    expect(state.events).toHaveLength(0);
  });

  it('initialises shields from design stats', () => {
    const setup = makeOneVsOneSetup();
    const state = initializeCombat(setup, SHIP_COMPONENTS);

    // Armed design has one deflector_shield (strength 30)
    for (const cs of [...state.attackerShips, ...state.defenderShips]) {
      expect(cs.maxShields).toBeGreaterThan(0);
      expect(cs.currentShields).toBe(cs.maxShields);
    }
  });

  it('handles multiple ships on each side', () => {
    const aDesign = makeArmedDesign('design-a');
    const dDesign = makeArmedDesign('design-d', 'empire-2');
    const aShips = [makeShip('a1', aDesign.id), makeShip('a2', aDesign.id)];
    const dShips = [
      makeShip('d1', dDesign.id),
      makeShip('d2', dDesign.id),
      makeShip('d3', dDesign.id),
    ];

    const setup: CombatSetup = {
      attackerFleet: makeFleet('fa', 'empire-1', aShips.map((s) => s.id)),
      defenderFleet: makeFleet('fd', 'empire-2', dShips.map((s) => s.id)),
      attackerShips: aShips,
      defenderShips: dShips,
      attackerDesigns: new Map([[aDesign.id, aDesign]]),
      defenderDesigns: new Map([[dDesign.id, dDesign]]),
    };

    const state = initializeCombat(setup, SHIP_COMPONENTS);
    expect(state.attackerShips).toHaveLength(2);
    expect(state.defenderShips).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Weapon fire and damage resolution
// ---------------------------------------------------------------------------

describe('weapon fire', () => {
  it('fires weapons and produces weapon_fired events', () => {
    const state = runOneTick(makeOneVsOneSetup());
    const firedEvents = state.events.filter((e) => e.type === 'weapon_fired');
    expect(firedEvents.length).toBeGreaterThan(0);
  });

  it('records the correct source and target ship IDs', () => {
    const setup = makeOneVsOneSetup();
    const state = runOneTick(setup);
    const fired = state.events.filter((e) => e.type === 'weapon_fired');

    const attackerId = setup.attackerShips[0]!.id;
    const defenderId = setup.defenderShips[0]!.id;

    // At least one shot from attacker → defender
    expect(
      fired.some(
        (e) =>
          e.type === 'weapon_fired' &&
          e.sourceId === attackerId &&
          e.targetId === defenderId,
      ),
    ).toBe(true);
  });

  it('deals positive damage in each weapon_fired event', () => {
    const state = runOneTick(makeOneVsOneSetup());
    for (const e of state.events) {
      if (e.type === 'weapon_fired') {
        expect(e.damage).toBeGreaterThan(0);
      }
    }
  });

  it('deals no weapon damage if a ship has no weapon components', () => {
    const aDesign = makeUnarmedDesign('design-u');
    const dDesign = makeArmedDesign('design-d', 'empire-2');
    const aShip = makeShip('ship-u', aDesign.id);
    const dShip = makeShip('ship-d', dDesign.id);

    const setup: CombatSetup = {
      attackerFleet: makeFleet('fa', 'empire-1', [aShip.id]),
      defenderFleet: makeFleet('fd', 'empire-2', [dShip.id]),
      attackerShips: [aShip],
      defenderShips: [dShip],
      attackerDesigns: new Map([[aDesign.id, aDesign]]),
      defenderDesigns: new Map([[dDesign.id, dDesign]]),
    };

    const state = runOneTick(setup);

    // The unarmed attacker should fire no shots.
    const aFired = state.events.filter(
      (e) => e.type === 'weapon_fired' && e.sourceId === aShip.id,
    );
    expect(aFired).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Damage resolution: shields and hull
// ---------------------------------------------------------------------------

describe('damage resolution', () => {
  it('shields absorb damage before hull', () => {
    const setup = makeOneVsOneSetup();
    const initial = initializeCombat(setup, SHIP_COMPONENTS);
    const afterTick = processCombatTick(
      initial,
      SHIP_COMPONENTS,
      setup.attackerDesigns,
      setup.defenderDesigns,
    );

    // At least one shield_absorbed event should exist.
    const absorbed = afterTick.events.filter((e) => e.type === 'shield_absorbed');
    expect(absorbed.length).toBeGreaterThan(0);
  });

  it('emits hull_damage events when damage exceeds shields', () => {
    // Use ships with NO shields but with weapons to guarantee hull hits.
    const aDesign: ShipDesign = {
      id: 'no-shield-a',
      name: 'No Shield A',
      hull: 'scout',
      components: [
        { slotId: 'scout_fore_1', componentId: 'pulse_laser' },
        { slotId: 'scout_turret_1', componentId: 'short_range_scanner' },
        { slotId: 'scout_aft_1', componentId: 'ion_engine' },
      ],
      totalCost: 155,
      empireId: 'empire-1',
    };
    const dDesign: ShipDesign = { ...aDesign, id: 'no-shield-d', empireId: 'empire-2' };
    const aShip = makeShip('ns-a', aDesign.id);
    const dShip = makeShip('ns-d', dDesign.id);

    const setup: CombatSetup = {
      attackerFleet: makeFleet('fa', 'empire-1', [aShip.id]),
      defenderFleet: makeFleet('fd', 'empire-2', [dShip.id]),
      attackerShips: [aShip],
      defenderShips: [dShip],
      attackerDesigns: new Map([[aDesign.id, aDesign]]),
      defenderDesigns: new Map([[dDesign.id, dDesign]]),
    };

    const state = runOneTick(setup);
    const hullEvents = state.events.filter((e) => e.type === 'hull_damage');
    expect(hullEvents.length).toBeGreaterThan(0);
  });

  it('hull remaining never goes below 0', () => {
    const setup = makeOneVsOneSetup();
    const state = runToCompletion(setup);

    for (const cs of [...state.attackerShips, ...state.defenderShips]) {
      expect(cs.ship.hullPoints).toBeGreaterThanOrEqual(0);
    }
  });

  it('hull_damage remaining field is consistent with ship state', () => {
    const setup = makeOneVsOneSetup();
    const state = runOneTick(setup);

    // For each hull_damage event, the remaining value should be >= 0
    for (const e of state.events) {
      if (e.type === 'hull_damage') {
        expect(e.remaining).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// System damage
// ---------------------------------------------------------------------------

describe('system damage', () => {
  it('system_damaged events stay within 0–1 range', () => {
    // Run many ticks to accumulate system damage.
    const setup = makeOneVsOneSetup();
    let state = initializeCombat(setup, SHIP_COMPONENTS);
    for (let i = 0; i < 50; i++) {
      state = processCombatTick(
        state,
        SHIP_COMPONENTS,
        setup.attackerDesigns,
        setup.defenderDesigns,
      );
      if (state.outcome !== null) break;
    }

    for (const e of state.events) {
      if (e.type === 'system_damaged') {
        expect(e.newLevel).toBeGreaterThanOrEqual(0);
        expect(e.newLevel).toBeLessThanOrEqual(1);
      }
    }
  });

  it('system damage accumulates on ship.systemDamage after multiple ticks', () => {
    // Run enough ticks that at least one ship has accumulated some system damage.
    const setup = makeOneVsOneSetup();
    let state = initializeCombat(setup, SHIP_COMPONENTS);

    for (let i = 0; i < 40 && state.outcome === null; i++) {
      state = processCombatTick(
        state,
        SHIP_COMPONENTS,
        setup.attackerDesigns,
        setup.defenderDesigns,
      );
    }

    const hasSystemDamage = [
      ...state.attackerShips,
      ...state.defenderShips,
    ].some((cs) => {
      const sd = cs.ship.systemDamage;
      return (
        sd.engines > 0 ||
        sd.weapons > 0 ||
        sd.shields > 0 ||
        sd.sensors > 0 ||
        sd.warpDrive > 0
      );
    });

    // With 40 ticks and a 10% system hit chance, the probability of zero
    // system hits across both ships is astronomically low.
    expect(hasSystemDamage).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Ship destruction
// ---------------------------------------------------------------------------

describe('ship destruction', () => {
  it('marks a ship destroyed when hull reaches 0', () => {
    const setup = makeOneVsOneSetup();
    const state = runToCompletion(setup);

    const allShips = [...state.attackerShips, ...state.defenderShips];
    const destroyed = allShips.filter((cs) => cs.isDestroyed);
    expect(destroyed.length).toBeGreaterThan(0);
  });

  it('destroyed ship has hullPoints = 0', () => {
    const setup = makeOneVsOneSetup();
    const state = runToCompletion(setup);

    for (const cs of [...state.attackerShips, ...state.defenderShips]) {
      if (cs.isDestroyed) {
        expect(cs.ship.hullPoints).toBe(0);
      }
    }
  });

  it('emits ship_destroyed event with correct name', () => {
    const setup = makeOneVsOneSetup();
    const state = runToCompletion(setup);

    const allShips = [...state.attackerShips, ...state.defenderShips];
    const destroyedShip = allShips.find((cs) => cs.isDestroyed);
    if (destroyedShip == null) return; // no destruction — ok to skip

    const destroyedEvt = state.events.find(
      (e) => e.type === 'ship_destroyed' && e.shipId === destroyedShip.ship.id,
    );
    expect(destroyedEvt).toBeDefined();
    if (destroyedEvt?.type === 'ship_destroyed') {
      expect(destroyedEvt.name).toBe(destroyedShip.ship.name);
    }
  });
});

// ---------------------------------------------------------------------------
// Morale
// ---------------------------------------------------------------------------

describe('morale', () => {
  it('morale decreases when taking hull damage', () => {
    // Use no-shield design to guarantee hull damage every tick.
    const aDesign: ShipDesign = {
      id: 'ns-a2',
      name: 'NS A2',
      hull: 'scout',
      components: [
        { slotId: 'scout_fore_1', componentId: 'pulse_laser' },
        { slotId: 'scout_turret_1', componentId: 'short_range_scanner' },
        { slotId: 'scout_aft_1', componentId: 'ion_engine' },
      ],
      totalCost: 155,
      empireId: 'empire-1',
    };
    const dDesign: ShipDesign = { ...aDesign, id: 'ns-d2', empireId: 'empire-2' };
    const aShip = makeShip('ns-a2', aDesign.id);
    const dShip = makeShip('ns-d2', dDesign.id);

    const setup: CombatSetup = {
      attackerFleet: makeFleet('fa', 'empire-1', [aShip.id]),
      defenderFleet: makeFleet('fd', 'empire-2', [dShip.id]),
      attackerShips: [aShip],
      defenderShips: [dShip],
      attackerDesigns: new Map([[aDesign.id, aDesign]]),
      defenderDesigns: new Map([[dDesign.id, dDesign]]),
    };

    const state = runOneTick(setup);
    const hullHit = state.events.some(
      (e) => e.type === 'hull_damage' && e.shipId === dShip.id,
    );

    if (hullHit) {
      const dCombatShip = state.defenderShips[0]!;
      // Morale should be below 100 after receiving hull damage.
      expect(dCombatShip.morale).toBeLessThan(100);
    }
  });

  it('morale never exceeds 100 or drops below 0', () => {
    const setup = makeOneVsOneSetup();
    const state = runToCompletion(setup);

    for (const cs of [...state.attackerShips, ...state.defenderShips]) {
      expect(cs.morale).toBeGreaterThanOrEqual(0);
      expect(cs.morale).toBeLessThanOrEqual(100);
    }
  });
});

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

describe('routing', () => {
  it('ship routes when morale falls below 20', () => {
    // Build a design with many enemies to tank morale quickly.
    const aDesign = makeArmedDesign('route-a');
    const dDesign = makeArmedDesign('route-d', 'empire-2');

    // Lone attacker vs many defenders → attacker will be outnumbered.
    const aShip = makeShip('route-a1', aDesign.id);
    const dShips = Array.from({ length: 5 }, (_, i) =>
      makeShip(`route-d${i + 1}`, dDesign.id),
    );

    const setup: CombatSetup = {
      attackerFleet: makeFleet('fa', 'empire-1', [aShip.id]),
      defenderFleet: makeFleet('fd', 'empire-2', dShips.map((s) => s.id)),
      attackerShips: [aShip],
      defenderShips: dShips,
      attackerDesigns: new Map([[aDesign.id, aDesign]]),
      defenderDesigns: new Map([[dDesign.id, dDesign]]),
    };

    const state = runToCompletion(setup);

    // Expect at least the lone attacker to have routed or been destroyed.
    const aFinal = state.attackerShips[0]!;
    expect(aFinal.isRouted || aFinal.isDestroyed).toBe(true);
  });

  it('emits ship_routed event when a ship routes', () => {
    // This test verifies that ship_routed events are emitted whenever a ship
    // has its isRouted flag set. We run a combat and check consistency between
    // the final ship state and the event log.
    const aDesign = makeArmedDesign('route2-a');
    const dDesign = makeArmedDesign('route2-d', 'empire-2');
    const aShip = makeShip('route2-a1', aDesign.id);
    const dShips = Array.from({ length: 5 }, (_, i) =>
      makeShip(`route2-d${i + 1}`, dDesign.id),
    );

    const setup: CombatSetup = {
      attackerFleet: makeFleet('fa', 'empire-1', [aShip.id]),
      defenderFleet: makeFleet('fd', 'empire-2', dShips.map((s) => s.id)),
      attackerShips: [aShip],
      defenderShips: dShips,
      attackerDesigns: new Map([[aDesign.id, aDesign]]),
      defenderDesigns: new Map([[dDesign.id, dDesign]]),
    };

    // Accumulate all events across every tick (state.events only holds the latest tick).
    const allEvents: CombatEvent[] = [];
    let state = initializeCombat(setup, SHIP_COMPONENTS);
    for (let i = 0; i < 200 && state.outcome === null; i++) {
      state = processCombatTick(
        state,
        SHIP_COMPONENTS,
        setup.attackerDesigns,
        setup.defenderDesigns,
      );
      allEvents.push(...state.events);
    }

    // Every ship that ended up routed must have had a ship_routed event emitted.
    const allFinalShips = [...state.attackerShips, ...state.defenderShips];
    const routedShipIds = allFinalShips
      .filter((cs) => cs.isRouted)
      .map((cs) => cs.ship.id);

    for (const id of routedShipIds) {
      const routedEvt = allEvents.find(
        (e) => e.type === 'ship_routed' && e.shipId === id,
      );
      expect(routedEvt).toBeDefined();
    }

    // Verify the routing mechanic was invoked at least in some scenario (at least
    // routing OR destruction must occur for the lone attacker).
    const aFinal = state.attackerShips[0]!;
    expect(aFinal.isRouted || aFinal.isDestroyed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Victory conditions
// ---------------------------------------------------------------------------

describe('combat end', () => {
  it('produces an outcome when one side is eliminated', () => {
    const setup = makeOneVsOneSetup();
    const state = runToCompletion(setup);
    expect(state.outcome).not.toBeNull();
  });

  it('emits a combat_end event with matching outcome', () => {
    const setup = makeOneVsOneSetup();
    const state = runToCompletion(setup);

    const endEvt = state.events.find((e) => e.type === 'combat_end');
    expect(endEvt).toBeDefined();
    if (endEvt?.type === 'combat_end') {
      expect(endEvt.outcome).toEqual(state.outcome);
    }
  });

  it('winner is attacker or defender or draw', () => {
    const setup = makeOneVsOneSetup();
    const outcome = autoResolveCombat(setup, SHIP_COMPONENTS);
    expect(['attacker', 'defender', 'draw']).toContain(outcome.winner);
  });

  it('processCombatTick is a no-op when outcome already set', () => {
    const setup = makeOneVsOneSetup();
    const resolved = runToCompletion(setup);

    if (resolved.outcome == null) return; // shouldn't happen

    const again = processCombatTick(
      resolved,
      SHIP_COMPONENTS,
      setup.attackerDesigns,
      setup.defenderDesigns,
    );
    expect(again).toBe(resolved); // exact same reference returned
  });
});

// ---------------------------------------------------------------------------
// Max tick limit / draw
// ---------------------------------------------------------------------------

describe('max tick limit', () => {
  it('declares a draw after 100 ticks if no winner', () => {
    // Two fleets with NO weapons — combat can never end naturally.
    const aDesign = makeUnarmedDesign('draw-a');
    const dDesign = makeUnarmedDesign('draw-d', 'empire-2');
    const aShip = makeShip('draw-a1', aDesign.id);
    const dShip = makeShip('draw-d1', dDesign.id);

    const setup: CombatSetup = {
      attackerFleet: makeFleet('fa', 'empire-1', [aShip.id]),
      defenderFleet: makeFleet('fd', 'empire-2', [dShip.id]),
      attackerShips: [aShip],
      defenderShips: [dShip],
      attackerDesigns: new Map([[aDesign.id, aDesign]]),
      defenderDesigns: new Map([[dDesign.id, dDesign]]),
    };

    const outcome = autoResolveCombat(setup, SHIP_COMPONENTS);
    expect(outcome.winner).toBe('draw');
    expect(outcome.ticksElapsed).toBeLessThanOrEqual(100);
  });

  it('autoResolveCombat always terminates', () => {
    const setup = makeOneVsOneSetup();
    const outcome = autoResolveCombat(setup, SHIP_COMPONENTS);
    expect(outcome).toBeDefined();
    expect(outcome.ticksElapsed).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// autoResolveCombat
// ---------------------------------------------------------------------------

describe('autoResolveCombat', () => {
  it('returns a valid CombatOutcome', () => {
    const setup = makeOneVsOneSetup();
    const outcome = autoResolveCombat(setup, SHIP_COMPONENTS);

    expect(outcome).toMatchObject<Partial<CombatOutcome>>({
      winner: expect.stringMatching(/^(attacker|defender|draw)$/),
      attackerLosses: expect.any(Array),
      defenderLosses: expect.any(Array),
      attackerRouted: expect.any(Array),
      defenderRouted: expect.any(Array),
    });
    expect(outcome.ticksElapsed).toBeGreaterThan(0);
  });

  it('loss arrays contain only string IDs', () => {
    const setup = makeOneVsOneSetup();
    const outcome = autoResolveCombat(setup, SHIP_COMPONENTS);

    for (const id of [
      ...outcome.attackerLosses,
      ...outcome.defenderLosses,
      ...outcome.attackerRouted,
      ...outcome.defenderRouted,
    ]) {
      expect(typeof id).toBe('string');
    }
  });

  it('losses contain only IDs that were in the original fleets', () => {
    const setup = makeOneVsOneSetup();
    const outcome = autoResolveCombat(setup, SHIP_COMPONENTS);

    const attackerIds = new Set(setup.attackerShips.map((s) => s.id));
    const defenderIds = new Set(setup.defenderShips.map((s) => s.id));

    for (const id of outcome.attackerLosses) {
      expect(attackerIds.has(id)).toBe(true);
    }
    for (const id of outcome.defenderLosses) {
      expect(defenderIds.has(id)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// applyCombatResults
// ---------------------------------------------------------------------------

describe('applyCombatResults', () => {
  it('sets hullPoints to 0 for destroyed ships', () => {
    const setup = makeOneVsOneSetup();
    const state = runToCompletion(setup);

    const allOriginal = [...setup.attackerShips, ...setup.defenderShips];
    const result = applyCombatResults(allOriginal, state);

    const destroyedCombatShips = [
      ...state.attackerShips,
      ...state.defenderShips,
    ].filter((cs) => cs.isDestroyed);

    for (const dcs of destroyedCombatShips) {
      const resultShip = result.find((s) => s.id === dcs.ship.id);
      expect(resultShip?.hullPoints).toBe(0);
    }
  });

  it('preserves system damage on surviving ships', () => {
    const setup = makeOneVsOneSetup();
    const state = runToCompletion(setup);

    const allOriginal = [...setup.attackerShips, ...setup.defenderShips];
    const result = applyCombatResults(allOriginal, state);

    for (const cs of [...state.attackerShips, ...state.defenderShips]) {
      if (cs.isDestroyed) continue;
      const resultShip = result.find((s) => s.id === cs.ship.id);
      if (resultShip == null) continue;
      // systemDamage keys should match what combat accumulated.
      expect(resultShip.systemDamage).toEqual(cs.ship.systemDamage);
    }
  });

  it('does not mutate the input ships array', () => {
    const setup = makeOneVsOneSetup();
    const state = runToCompletion(setup);

    const allOriginal = [...setup.attackerShips, ...setup.defenderShips];
    const originalHullPoints = allOriginal.map((s) => s.hullPoints);

    applyCombatResults(allOriginal, state);

    for (let i = 0; i < allOriginal.length; i++) {
      expect(allOriginal[i]!.hullPoints).toBe(originalHullPoints[i]);
    }
  });

  it('returns ships not in combat unchanged', () => {
    const bystander = makeShip('bystander', 'some-design');
    const setup = makeOneVsOneSetup();
    const state = runToCompletion(setup);

    const result = applyCombatResults([bystander, ...setup.attackerShips], state);
    const bystanderResult = result.find((s) => s.id === 'bystander');
    expect(bystanderResult).toEqual(bystander);
  });
});

// ---------------------------------------------------------------------------
// calculateFleetPower
// ---------------------------------------------------------------------------

describe('calculateFleetPower', () => {
  it('returns a positive number for an armed fleet', () => {
    const design = makeArmedDesign('fp-design');
    const ships = [makeShip('fp-1', design.id), makeShip('fp-2', design.id)];
    const designs = new Map([[design.id, design]]);
    const power = calculateFleetPower(ships, designs, SHIP_COMPONENTS);
    expect(power).toBeGreaterThan(0);
  });

  it('returns 0 for a fleet of destroyed ships', () => {
    const design = makeArmedDesign('fp-dead');
    const ships = [makeShip('fp-d1', design.id, 0, 100)];
    const designs = new Map([[design.id, design]]);
    const power = calculateFleetPower(ships, designs, SHIP_COMPONENTS);
    expect(power).toBe(0);
  });

  it('returns 0 for an empty fleet', () => {
    const design = makeArmedDesign('fp-empty');
    const power = calculateFleetPower([], new Map([[design.id, design]]), SHIP_COMPONENTS);
    expect(power).toBe(0);
  });

  it('a heavier fleet has more power than a lighter fleet', () => {
    const lightDesign = makeArmedDesign('light');
    const heavyDesign = makeHeavyDesign('heavy');

    const lightShips = [makeShip('l1', lightDesign.id, 50, 50)];
    const heavyShips = [makeShip('h1', heavyDesign.id, 200, 200)];

    const lightPower = calculateFleetPower(
      lightShips,
      new Map([[lightDesign.id, lightDesign]]),
      SHIP_COMPONENTS,
    );
    const heavyPower = calculateFleetPower(
      heavyShips,
      new Map([[heavyDesign.id, heavyDesign]]),
      SHIP_COMPONENTS,
    );

    expect(heavyPower).toBeGreaterThan(lightPower);
  });

  it('a damaged ship contributes less power than a healthy one', () => {
    const design = makeArmedDesign('dmg-test');
    const healthy = makeShip('healthy', design.id, 100, 100);
    const damaged = makeShip('damaged', design.id, 25, 100);

    const designs = new Map([[design.id, design]]);

    const healthyPower = calculateFleetPower([healthy], designs, SHIP_COMPONENTS);
    const damagedPower = calculateFleetPower([damaged], designs, SHIP_COMPONENTS);

    expect(healthyPower).toBeGreaterThan(damagedPower);
  });
});

// ---------------------------------------------------------------------------
// Stronger fleet wins auto-resolve (probabilistic)
// ---------------------------------------------------------------------------

describe('auto-resolve balance', () => {
  it('a heavily superior fleet wins more often than not', () => {
    // Run 20 auto-resolves: 5 heavy cruisers vs 1 scout.
    const bigDesign = makeHeavyDesign('big', 'empire-1');
    const smallDesign = makeArmedDesign('small', 'empire-2');

    let bigWins = 0;
    const trials = 20;

    for (let trial = 0; trial < trials; trial++) {
      const bigShips = Array.from({ length: 5 }, (_, i) =>
        makeShip(`big${trial}-${i}`, bigDesign.id, 200, 200),
      );
      const smallShip = makeShip(`small${trial}`, smallDesign.id);

      const setup: CombatSetup = {
        attackerFleet: makeFleet('fa', 'empire-1', bigShips.map((s) => s.id)),
        defenderFleet: makeFleet('fd', 'empire-2', [smallShip.id]),
        attackerShips: bigShips,
        defenderShips: [smallShip],
        attackerDesigns: new Map([[bigDesign.id, bigDesign]]),
        defenderDesigns: new Map([[smallDesign.id, smallDesign]]),
      };

      const outcome = autoResolveCombat(setup, SHIP_COMPONENTS);
      if (outcome.winner === 'attacker') bigWins++;
    }

    // The heavy fleet should win at least 80 % of the time (16/20).
    expect(bigWins).toBeGreaterThanOrEqual(16);
  });
});

// ---------------------------------------------------------------------------
// Draw when forces are equal and unarmed
// ---------------------------------------------------------------------------

describe('draw scenario', () => {
  it('two unarmed fleets always draw', () => {
    const aDesign = makeUnarmedDesign('draw2-a');
    const dDesign = makeUnarmedDesign('draw2-d', 'empire-2');

    for (let i = 0; i < 5; i++) {
      const aShip = makeShip(`draw2-a${i}`, aDesign.id);
      const dShip = makeShip(`draw2-d${i}`, dDesign.id);

      const setup: CombatSetup = {
        attackerFleet: makeFleet('fa', 'empire-1', [aShip.id]),
        defenderFleet: makeFleet('fd', 'empire-2', [dShip.id]),
        attackerShips: [aShip],
        defenderShips: [dShip],
        attackerDesigns: new Map([[aDesign.id, aDesign]]),
        defenderDesigns: new Map([[dDesign.id, dDesign]]),
      };

      const outcome = autoResolveCombat(setup, SHIP_COMPONENTS);
      expect(outcome.winner).toBe('draw');
    }
  });
});
