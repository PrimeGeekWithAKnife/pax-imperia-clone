import { describe, it, expect } from 'vitest';

import {
  generateBattleReport,
  calculateExperienceGain,
  getAllowedPolicies,
} from '../engine/combat-tactical.js';
import type {
  TacticalState,
  TacticalShip,
  CrewExperience,
  BattleReport,
} from '../engine/combat-tactical.js';
import type { Fleet, Ship, ShipDesign } from '../types/ships.js';

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
    hull: 'corvette',
    components: [
      { slotId: 'scout_fore_1', componentId: 'pulse_laser' },
      { slotId: 'scout_turret_1', componentId: 'deflector_shield' },
      { slotId: 'scout_aft_1', componentId: 'ion_engine' },
    ],
    totalCost: 185,
    empireId,
  };
}

function makeTacticalShip(
  id: string,
  side: 'attacker' | 'defender',
  overrides: Partial<TacticalShip> = {},
): TacticalShip {
  return {
    id: `tactical-${id}`,
    sourceShipId: id,
    name: `Ship ${id}`,
    side,
    position: { x: side === 'attacker' ? 100 : 1500, y: 500 },
    facing: side === 'attacker' ? 0 : Math.PI,
    speed: 1.5,
    turnRate: 0.08,
    hull: 80,
    maxHull: 100,
    shields: 0,
    maxShields: 20,
    armour: 0,
    weapons: [],
    sensorRange: 200,
    order: { type: 'idle' },
    destroyed: false,
    routed: false, stance: "aggressive" as any, damageTakenThisTick: 0,
    crew: {
      morale: 100,
      health: 100,
      experience: 'recruit',
    },
    ...overrides,
  };
}

function makeState(ships: TacticalShip[], outcome: TacticalState['outcome'] = null): TacticalState {
  return {
    tick: 50,
    ships,
    projectiles: [],
    missiles: [],
    fighters: [],
    beamEffects: [],
    pointDefenceEffects: [],
    environment: [],
    battlefieldWidth: 1600,
    battlefieldHeight: 1000,
    outcome,
    attackerFormation: 'line',
    defenderFormation: 'line',
    admirals: [],
    layout: 'open_space',
  };
}

// ---------------------------------------------------------------------------
// generateBattleReport tests
// ---------------------------------------------------------------------------

describe('generateBattleReport', () => {
  it('identifies attacker as winner when outcome is attacker_wins', () => {
    const ships = [
      makeTacticalShip('a1', 'attacker'),
      makeTacticalShip('a2', 'attacker'),
      makeTacticalShip('d1', 'defender', { destroyed: true, hull: 0 }),
    ];
    const state = makeState(ships, 'attacker_wins');
    const report = generateBattleReport(state);

    expect(report.winner).toBe('attacker');
    expect(report.ticksElapsed).toBe(50);
  });

  it('identifies defender as winner when outcome is defender_wins', () => {
    const ships = [
      makeTacticalShip('a1', 'attacker', { destroyed: true, hull: 0 }),
      makeTacticalShip('d1', 'defender'),
      makeTacticalShip('d2', 'defender'),
    ];
    const state = makeState(ships, 'defender_wins');
    const report = generateBattleReport(state);

    expect(report.winner).toBe('defender');
  });

  it('reports draw when outcome is null', () => {
    const ships = [
      makeTacticalShip('a1', 'attacker'),
      makeTacticalShip('d1', 'defender'),
    ];
    const state = makeState(ships, null);
    const report = generateBattleReport(state);

    expect(report.winner).toBe('draw');
  });

  it('counts ships engaged, destroyed, routed, and survived correctly', () => {
    const ships = [
      makeTacticalShip('a1', 'attacker'),
      makeTacticalShip('a2', 'attacker', { destroyed: true, hull: 0 }),
      makeTacticalShip('a3', 'attacker', { routed: true }),
      makeTacticalShip('d1', 'defender'),
      makeTacticalShip('d2', 'defender', { destroyed: true, hull: 0 }),
    ];
    const state = makeState(ships, 'attacker_wins');
    const report = generateBattleReport(state);

    expect(report.attacker.shipsEngaged).toBe(3);
    expect(report.attacker.shipsDestroyed).toBe(1);
    expect(report.attacker.shipsRouted).toBe(1);
    expect(report.attacker.shipsSurvived).toBe(1);

    expect(report.defender.shipsEngaged).toBe(2);
    expect(report.defender.shipsDestroyed).toBe(1);
    expect(report.defender.shipsRouted).toBe(0);
    expect(report.defender.shipsSurvived).toBe(1);
  });

  it('calculates salvage that scales with destroyed ships', () => {
    // 1 destroyed ship = 50 credits, 20 minerals
    const oneDestroyed = [
      makeTacticalShip('a1', 'attacker'),
      makeTacticalShip('d1', 'defender', { destroyed: true, hull: 0 }),
    ];
    const reportOne = generateBattleReport(makeState(oneDestroyed, 'attacker_wins'));
    expect(reportOne.salvage.credits).toBe(50);
    expect(reportOne.salvage.minerals).toBe(20);

    // 3 destroyed ships = 150 credits, 60 minerals
    const threeDestroyed = [
      makeTacticalShip('a1', 'attacker', { destroyed: true, hull: 0 }),
      makeTacticalShip('a2', 'attacker'),
      makeTacticalShip('d1', 'defender', { destroyed: true, hull: 0 }),
      makeTacticalShip('d2', 'defender', { destroyed: true, hull: 0 }),
    ];
    const reportThree = generateBattleReport(makeState(threeDestroyed, 'defender_wins'));
    expect(reportThree.salvage.credits).toBe(150);
    expect(reportThree.salvage.minerals).toBe(60);
  });

  it('produces zero salvage when no ships are destroyed', () => {
    const ships = [
      makeTacticalShip('a1', 'attacker'),
      makeTacticalShip('d1', 'defender'),
    ];
    const report = generateBattleReport(makeState(ships, null));
    expect(report.salvage.credits).toBe(0);
    expect(report.salvage.minerals).toBe(0);
  });

  it('includes experience promotions for surviving ships', () => {
    // Equal numbers: 2 vs 2, so the loser is not outnumbered
    const ships = [
      makeTacticalShip('a1', 'attacker', { crew: { morale: 100, health: 100, experience: 'recruit' } }),
      makeTacticalShip('a2', 'attacker', { destroyed: true, hull: 0 }),
      makeTacticalShip('d1', 'defender', { crew: { morale: 100, health: 100, experience: 'recruit' } }),
      makeTacticalShip('d2', 'defender', { destroyed: true, hull: 0 }),
    ];
    const state = makeState(ships, 'attacker_wins');
    const report = generateBattleReport(state);

    // Winning green crew should be promoted
    expect(report.attacker.experienceGained.length).toBe(1);
    expect(report.attacker.experienceGained[0]!.shipId).toBe('a1');
    expect(report.attacker.experienceGained[0]!.newExperience).toBe('regular');

    // Losing side green crew stays green (not victorious, equal numbers so not outnumbered)
    expect(report.defender.experienceGained.length).toBe(1);
    expect(report.defender.experienceGained[0]!.newExperience).toBe('recruit');
  });

  it('does not include destroyed ships in experience promotions', () => {
    const ships = [
      makeTacticalShip('a1', 'attacker'),
      makeTacticalShip('d1', 'defender', { destroyed: true, hull: 0 }),
    ];
    const state = makeState(ships, 'attacker_wins');
    const report = generateBattleReport(state);

    // Only surviving ships get experience
    expect(report.defender.experienceGained).toHaveLength(0);
    expect(report.attacker.experienceGained).toHaveLength(1);
  });

  it('estimates damage dealt based on enemy HP loss', () => {
    const ships = [
      makeTacticalShip('a1', 'attacker', { hull: 90, maxHull: 100, shields: 0, maxShields: 20 }),
      makeTacticalShip('d1', 'defender', { hull: 50, maxHull: 100, shields: 0, maxShields: 20 }),
    ];
    const state = makeState(ships, 'attacker_wins');
    const report = generateBattleReport(state);

    // Attacker dealt damage to defender: (100-50) hull + (20-0) shields = 70
    expect(report.attacker.totalDamageDealt).toBe(70);
    // Defender dealt damage to attacker: (100-90) hull + (20-0) shields = 30
    expect(report.defender.totalDamageDealt).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// Experience gain tests
// ---------------------------------------------------------------------------

describe('calculateExperienceGain', () => {
  it('promotes green crew to regular on victory', () => {
    const ship = makeTacticalShip('s1', 'attacker', {
      crew: { morale: 100, health: 100, experience: 'recruit' },
    });
    const result = calculateExperienceGain(ship, true, 3, 3);
    expect(result).toBe('regular');
  });

  it('does not promote losing crew in equal battle', () => {
    const ship = makeTacticalShip('s1', 'defender', {
      crew: { morale: 100, health: 100, experience: 'recruit' },
    });
    const result = calculateExperienceGain(ship, false, 3, 3);
    expect(result).toBe('recruit');
  });

  it('promotes losing crew when significantly outnumbered', () => {
    const ship = makeTacticalShip('s1', 'defender', {
      crew: { morale: 100, health: 100, experience: 'recruit' },
    });
    // 5 enemies vs 2 allies: outnumbered by more than 1.5x
    const result = calculateExperienceGain(ship, false, 5, 2);
    expect(result).toBe('regular');
  });

  it('caps at elite for normal victories, ace/legendary for outnumbered', () => {
    const ship = makeTacticalShip('s1', 'attacker', {
      crew: { morale: 100, health: 100, experience: 'elite' },
    });
    // Normal victory (not heavily outnumbered): caps at elite
    const normalResult = calculateExperienceGain(ship, true, 3, 3);
    expect(normalResult).toBe('elite');
    // Heavily outnumbered victory (10 vs 1): can reach legendary
    const outnumberedResult = calculateExperienceGain(ship, true, 10, 1);
    expect(['ace', 'legendary']).toContain(outnumberedResult);
  });

  it('promotes veteran to elite on victory', () => {
    const ship = makeTacticalShip('s1', 'attacker', {
      crew: { morale: 100, health: 100, experience: 'veteran' },
    });
    const result = calculateExperienceGain(ship, true, 3, 3);
    expect(result).toBe('elite');
  });
});

// ---------------------------------------------------------------------------
// Occupation policy filtering tests
// ---------------------------------------------------------------------------

describe('getAllowedPolicies', () => {
  it('allows only basic policies for peaceful species (combat <= 3)', () => {
    const policies = getAllowedPolicies(2);
    expect(policies).toContain('peaceful_occupation');
    expect(policies).toContain('re_education');
    expect(policies).toContain('decapitate_leadership');
    expect(policies).toContain('raze_and_loot');
    expect(policies).not.toContain('forced_labour');
    expect(policies).not.toContain('enslavement');
    expect(policies).not.toContain('mass_genocide');
  });

  it('unlocks forced labour at combat >= 4', () => {
    const policies = getAllowedPolicies(4);
    expect(policies).toContain('forced_labour');
    expect(policies).not.toContain('enslavement');
    expect(policies).not.toContain('mass_genocide');
  });

  it('unlocks enslavement at combat >= 7', () => {
    const policies = getAllowedPolicies(7);
    expect(policies).toContain('forced_labour');
    expect(policies).toContain('enslavement');
    expect(policies).not.toContain('mass_genocide');
  });

  it('unlocks mass genocide at combat >= 9', () => {
    const policies = getAllowedPolicies(9);
    expect(policies).toContain('forced_labour');
    expect(policies).toContain('enslavement');
    expect(policies).toContain('mass_genocide');
  });

  it('includes all 7 policies for combat 10', () => {
    const policies = getAllowedPolicies(10);
    expect(policies).toHaveLength(7);
  });

  it('includes only 4 policies for combat 1', () => {
    const policies = getAllowedPolicies(1);
    expect(policies).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// crewExperience field on Ship type
// ---------------------------------------------------------------------------

describe('Ship.crewExperience', () => {
  it('accepts a crewExperience value', () => {
    const ship = makeShip('s1', 'd1');
    ship.crewExperience = 'veteran';
    expect(ship.crewExperience).toBe('veteran');
  });

  it('defaults to undefined when not set', () => {
    const ship = makeShip('s1', 'd1');
    expect(ship.crewExperience).toBeUndefined();
  });
});
