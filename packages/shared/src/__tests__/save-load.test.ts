/**
 * Tests for save/load serialisation and deserialisation.
 *
 * Covers:
 *  - serializeTickState / deserializeTickState round-trip
 *  - createSaveGame envelope creation
 *  - loadSaveGame restoration
 *  - JSON transparency (the serialised form must survive JSON.stringify → parse)
 *  - Version compatibility guard
 */

import { describe, it, expect } from 'vitest';
import {
  serializeTickState,
  deserializeTickState,
  createSaveGame,
  loadSaveGame,
  validateSaveGame,
  SAVE_FORMAT_VERSION,
} from '../engine/save-load.js';
import {
  initializeTickState,
  processGameTick,
} from '../engine/game-loop.js';
import { initializeGame, type GameSetupConfig, type PlayerSetup } from '../engine/game-init.js';
import type { Species } from '../types/species.js';
import type { GameTickState } from '../engine/game-loop.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSpecies(id: string): Species {
  return {
    id,
    name: `Species ${id}`,
    description: 'Test species',
    portrait: `portrait_${id}`,
    isPrebuilt: true,
    specialAbilities: [],
    traits: {
      construction: 5,
      reproduction: 5,
      research: 5,
      espionage: 5,
      economy: 5,
      combat: 5,
      diplomacy: 5,
    },
    environmentPreference: {
      idealTemperature: 288,
      temperatureTolerance: 50,
      idealGravity: 1.0,
      gravityTolerance: 0.4,
      preferredAtmospheres: ['oxygen_nitrogen'],
    },
  };
}

function makePlayerSetup(id: string, isAI = false): PlayerSetup {
  return {
    species: makeSpecies(id),
    empireName: `Empire ${id}`,
    color: `#${id.charCodeAt(0).toString(16).padStart(6, '0')}`,
    isAI,
  };
}

function makeTickState(seed = 42): GameTickState {
  const config: GameSetupConfig = {
    galaxyConfig: { seed, size: 'small', shape: 'elliptical', playerCount: 2 },
    players: [makePlayerSetup('a'), makePlayerSetup('b', true)],
  };
  const gameState = initializeGame(config);
  return initializeTickState(gameState);
}

// ---------------------------------------------------------------------------
// serializeTickState / deserializeTickState
// ---------------------------------------------------------------------------

describe('serializeTickState', () => {
  it('converts Maps to arrays of tuples', () => {
    const ts = makeTickState();
    const serialised = serializeTickState(ts);

    expect(Array.isArray(serialised.researchStates)).toBe(true);
    expect(Array.isArray(serialised.empireResourcesMap)).toBe(true);
    expect(Array.isArray(serialised.economicLeadTicks)).toBe(true);
    expect(Array.isArray(serialised.terraformingProgressMap)).toBe(true);
    expect(Array.isArray(serialised.shipDesigns)).toBe(true);
  });

  it('preserves empire count in researchStates', () => {
    const ts = makeTickState();
    const serialised = serializeTickState(ts);
    expect(serialised.researchStates.length).toBe(ts.researchStates.size);
  });

  it('preserves empire count in empireResourcesMap', () => {
    const ts = makeTickState();
    const serialised = serializeTickState(ts);
    expect(serialised.empireResourcesMap.length).toBe(ts.empireResourcesMap.size);
  });

  it('preserves plain arrays unchanged', () => {
    const ts = makeTickState();
    const serialised = serializeTickState(ts);
    expect(serialised.movementOrders).toEqual(ts.movementOrders);
    expect(serialised.productionOrders).toEqual(ts.productionOrders);
    expect(serialised.migrationOrders).toEqual(ts.migrationOrders);
    expect(serialised.tradeRoutes).toEqual(ts.tradeRoutes);
  });
});

describe('deserializeTickState', () => {
  it('restores Maps from arrays', () => {
    const ts = makeTickState();
    const serialised = serializeTickState(ts);
    const restored = deserializeTickState(serialised);

    expect(restored.researchStates).toBeInstanceOf(Map);
    expect(restored.empireResourcesMap).toBeInstanceOf(Map);
    expect(restored.economicLeadTicks).toBeInstanceOf(Map);
    expect(restored.terraformingProgressMap).toBeInstanceOf(Map);
    expect(restored.shipDesigns).toBeInstanceOf(Map);
  });

  it('round-trips Map sizes correctly', () => {
    const ts = makeTickState();
    const restored = deserializeTickState(serializeTickState(ts));

    expect(restored.researchStates.size).toBe(ts.researchStates.size);
    expect(restored.empireResourcesMap.size).toBe(ts.empireResourcesMap.size);
  });

  it('round-trips researchState entries', () => {
    const ts = makeTickState();
    const restored = deserializeTickState(serializeTickState(ts));

    for (const [empireId, original] of ts.researchStates) {
      const r = restored.researchStates.get(empireId);
      expect(r).toBeDefined();
      expect(r!.completedTechs).toEqual(original.completedTechs);
      expect(r!.currentAge).toBe(original.currentAge);
    }
  });

  it('round-trips empireResourcesMap entries', () => {
    const ts = makeTickState();
    const restored = deserializeTickState(serializeTickState(ts));

    for (const [empireId, original] of ts.empireResourcesMap) {
      const r = restored.empireResourcesMap.get(empireId);
      expect(r).toBeDefined();
      expect(r!.credits).toBe(original.credits);
      expect(r!.minerals).toBe(original.minerals);
    }
  });

  it('round-trips gameState tick counter', () => {
    const ts = makeTickState();
    const restored = deserializeTickState(serializeTickState(ts));
    expect(restored.gameState.currentTick).toBe(ts.gameState.currentTick);
  });

  it('round-trips galaxy systems', () => {
    const ts = makeTickState();
    const restored = deserializeTickState(serializeTickState(ts));
    expect(restored.gameState.galaxy.systems.length).toBe(
      ts.gameState.galaxy.systems.length,
    );
  });
});

// ---------------------------------------------------------------------------
// JSON transparency
// ---------------------------------------------------------------------------

describe('JSON transparency', () => {
  it('survives JSON.stringify → JSON.parse without losing data', () => {
    const ts = makeTickState();
    const serialised = serializeTickState(ts);
    const json = JSON.stringify(serialised);
    const parsed = JSON.parse(json) as typeof serialised;
    const restored = deserializeTickState(parsed);

    expect(restored.researchStates.size).toBe(ts.researchStates.size);
    expect(restored.empireResourcesMap.size).toBe(ts.empireResourcesMap.size);
    expect(restored.gameState.currentTick).toBe(ts.gameState.currentTick);
    expect(restored.gameState.empires.length).toBe(ts.gameState.empires.length);
  });

  it('is valid JSON (no undefined, no circular refs)', () => {
    const ts = makeTickState();
    expect(() => JSON.stringify(serializeTickState(ts))).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// createSaveGame
// ---------------------------------------------------------------------------

describe('createSaveGame', () => {
  it('sets version to SAVE_FORMAT_VERSION', () => {
    const ts = makeTickState();
    const save = createSaveGame(ts, 'TestPlayer');
    expect(save.version).toBe(SAVE_FORMAT_VERSION);
  });

  it('sets playerName', () => {
    const ts = makeTickState();
    const save = createSaveGame(ts, 'Commander Shepard');
    expect(save.playerName).toBe('Commander Shepard');
  });

  it('sets timestamp as a recent Unix ms value', () => {
    const before = Date.now();
    const ts = makeTickState();
    const save = createSaveGame(ts, 'Player');
    const after = Date.now();
    expect(save.timestamp).toBeGreaterThanOrEqual(before);
    expect(save.timestamp).toBeLessThanOrEqual(after);
  });

  it('detects human empire (non-AI) as player empire', () => {
    const ts = makeTickState(); // player 'a' is human
    const save = createSaveGame(ts, 'Player');
    const humanEmpire = ts.gameState.empires.find(e => !e.isAI);
    expect(save.empireName).toBe(humanEmpire?.name);
    expect(save.speciesId).toBe(humanEmpire?.species.id);
  });

  it('embeds a serialised tick state', () => {
    const ts = makeTickState();
    const save = createSaveGame(ts, 'Player');
    expect(Array.isArray(save.tickState.researchStates)).toBe(true);
    expect(Array.isArray(save.tickState.empireResourcesMap)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// loadSaveGame
// ---------------------------------------------------------------------------

describe('loadSaveGame', () => {
  it('restores a GameTickState from a SaveGame', () => {
    const ts = makeTickState();
    const save = createSaveGame(ts, 'Player');
    const restored = loadSaveGame(save);

    expect(restored.researchStates).toBeInstanceOf(Map);
    expect(restored.empireResourcesMap).toBeInstanceOf(Map);
    expect(restored.gameState.currentTick).toBe(ts.gameState.currentTick);
  });

  it('round-trips through JSON.stringify → JSON.parse', () => {
    const ts = makeTickState();
    const save = createSaveGame(ts, 'Player');
    const json = JSON.stringify(save);
    const parsed = JSON.parse(json);
    const restored = loadSaveGame(parsed);

    expect(restored.researchStates.size).toBe(ts.researchStates.size);
    expect(restored.gameState.empires.length).toBe(ts.gameState.empires.length);
  });

  it('throws on major version mismatch', () => {
    const ts = makeTickState();
    const save = createSaveGame(ts, 'Player');
    const badSave = { ...save, version: '99.0.0' };
    expect(() => loadSaveGame(badSave)).toThrow(/incompatible/i);
  });

  it('accepts the same major version with a different minor', () => {
    const ts = makeTickState();
    const save = createSaveGame(ts, 'Player');
    // e.g. 0.99.0 — same major (0), different minor
    const minorBumped = { ...save, version: '0.99.0' };
    expect(() => loadSaveGame(minorBumped)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Post-load simulation continuity
// ---------------------------------------------------------------------------

describe('simulation continuity after load', () => {
  it('can advance ticks after deserialisation', () => {
    const ts = makeTickState();
    const restored = deserializeTickState(serializeTickState(ts));
    // Should not throw
    expect(() => processGameTick(restored)).not.toThrow();
  });

  it('tick counter increments after loading', () => {
    const ts = makeTickState();
    const save = createSaveGame(ts, 'Player');
    const json = JSON.stringify(save);
    const restored = loadSaveGame(JSON.parse(json));
    const { newState } = processGameTick(restored);
    expect(newState.gameState.currentTick).toBe(ts.gameState.currentTick + 1);
  });

  it('empire resource map remains functional after round-trip', () => {
    const ts = makeTickState();
    const restored = deserializeTickState(serializeTickState(ts));
    for (const empire of restored.gameState.empires) {
      // Should not throw and should return a value
      const res = restored.empireResourcesMap.get(empire.id);
      expect(res).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// validateSaveGame
// ---------------------------------------------------------------------------

describe('validateSaveGame', () => {
  it('accepts a valid save game', () => {
    const ts = makeTickState();
    const save = createSaveGame(ts, 'Player');
    const result = validateSaveGame(save);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing version', () => {
    const ts = makeTickState();
    const save = createSaveGame(ts, 'Player');
    (save as any).version = undefined;
    const result = validateSaveGame(save);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('version'));
  });

  it('rejects missing tickState', () => {
    const save = { version: '0.1.0', timestamp: 0, playerName: '', speciesId: '', empireName: '' } as any;
    const result = validateSaveGame(save);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('tickState'));
  });

  it('rejects missing gameState', () => {
    const save = { version: '0.1.0', timestamp: 0, playerName: '', speciesId: '', empireName: '', tickState: {} } as any;
    const result = validateSaveGame(save);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('gameState'));
  });

  it('detects no empires', () => {
    const ts = makeTickState();
    const save = createSaveGame(ts, 'Player');
    save.tickState.gameState.empires = [];
    const result = validateSaveGame(save);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('No empires'));
  });

  it('detects no star systems', () => {
    const ts = makeTickState();
    const save = createSaveGame(ts, 'Player');
    save.tickState.gameState.galaxy.systems = [];
    const result = validateSaveGame(save);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('No star systems'));
  });

  it('detects negative tick counter', () => {
    const ts = makeTickState();
    const save = createSaveGame(ts, 'Player');
    save.tickState.gameState.currentTick = -5;
    const result = validateSaveGame(save);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('tick counter'));
  });

  it('detects negative empire credits', () => {
    const ts = makeTickState();
    const save = createSaveGame(ts, 'Player');
    save.tickState.gameState.empires[0].credits = -100;
    const result = validateSaveGame(save);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('negative credits'));
  });

  it('detects negative planet population', () => {
    const ts = makeTickState();
    const save = createSaveGame(ts, 'Player');
    const systems = save.tickState.gameState.galaxy.systems;
    // Find a planet to corrupt
    for (const sys of systems) {
      if (sys.planets.length > 0) {
        sys.planets[0].currentPopulation = -10;
        break;
      }
    }
    const result = validateSaveGame(save);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('negative population'));
  });

  it('detects negative ship hull points', () => {
    const ts = makeTickState();
    const save = createSaveGame(ts, 'Player');
    // Inject a corrupted ship
    save.tickState.gameState.ships.push({
      id: 'corrupt-ship',
      designId: 'x',
      name: 'Broken Vessel',
      hullPoints: -5,
      maxHullPoints: 100,
      systemDamage: { engines: 0, weapons: 0, shields: 0, sensors: 0, warpDrive: 0 },
      position: { systemId: 'sys-0' },
      fleetId: null,
    });
    const result = validateSaveGame(save);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('negative hull points'));
  });

  it('detects zero maxHullPoints on ship', () => {
    const ts = makeTickState();
    const save = createSaveGame(ts, 'Player');
    save.tickState.gameState.ships.push({
      id: 'corrupt-ship-2',
      designId: 'x',
      name: 'Ghost Ship',
      hullPoints: 0,
      maxHullPoints: 0,
      systemDamage: { engines: 0, weapons: 0, shields: 0, sensors: 0, warpDrive: 0 },
      position: { systemId: 'sys-0' },
      fleetId: null,
    });
    const result = validateSaveGame(save);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('invalid maxHullPoints'));
  });

  it('loadSaveGame still loads a save with warnings (does not throw)', () => {
    const ts = makeTickState();
    const save = createSaveGame(ts, 'Player');
    // Corrupt credits but keep it structurally valid
    save.tickState.gameState.empires[0].credits = -999;
    // Should not throw — just warn
    expect(() => loadSaveGame(save)).not.toThrow();
  });
});
