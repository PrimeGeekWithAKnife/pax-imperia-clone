/**
 * Empire initialisation and game start logic for Ex Nihilo.
 *
 * Entry point: initializeGame(config) → GameState
 *
 * All functions are pure except initializeGame, which calls generateGalaxy()
 * (deterministic given a seed).
 */

import type { Galaxy, StarSystem, Planet, Building, BuildingType } from '../types/galaxy.js';
import type { Empire, Species } from '../types/species.js';
import type { Fleet, Ship, HullClass } from '../types/ships.js';
import type { EmpireResources } from '../types/resources.js';
import type { GameState } from '../types/game-state.js';
import type { GalaxyGenerationConfig } from '../generation/galaxy-generator.js';
import type { AIPersonality } from '../types/species.js';
import { generateGalaxy } from '../generation/galaxy-generator.js';
import { calculateHabitability } from './colony.js';
import { generateId } from '../utils/id.js';
import { STARTING_CREDITS, STARTING_RESEARCH_POINTS } from '../constants/game.js';

// ── Public interfaces ─────────────────────────────────────────────────────────

export interface GameSetupConfig {
  galaxyConfig: GalaxyGenerationConfig;
  players: PlayerSetup[];
}

export interface PlayerSetup {
  species: Species;
  empireName: string;
  color: string;
  isAI: boolean;
  aiPersonality?: AIPersonality;
}

/** Minimum habitability for a planet to be considered as a valid home world. */
const HOME_PLANET_MIN_HABITABILITY = 60;

// ── Helpers ───────────────────────────────────────────────────────────────────


/**
 * Returns a set of system IDs reachable from `startId` within `hops` wormhole
 * hops (inclusive of `startId`).
 */
function systemsWithinHops(
  galaxy: Galaxy,
  startId: string,
  hops: number,
): Set<string> {
  const idToSystem = new Map<string, StarSystem>(galaxy.systems.map(s => [s.id, s]));
  const visited = new Set<string>([startId]);
  let frontier = new Set<string>([startId]);

  for (let h = 0; h < hops; h++) {
    const next = new Set<string>();
    for (const id of frontier) {
      const sys = idToSystem.get(id);
      if (!sys) continue;
      for (const neighbourId of sys.wormholes) {
        if (!visited.has(neighbourId)) {
          visited.add(neighbourId);
          next.add(neighbourId);
        }
      }
    }
    frontier = next;
  }

  return visited;
}

/** Returns the best (highest habitability) planet in a system for the species. */
function bestHabitablePlanet(
  system: StarSystem,
  species: Species,
): { planet: Planet; score: number } | null {
  let best: { planet: Planet; score: number } | null = null;

  for (const planet of system.planets) {
    if (planet.type === 'gas_giant') continue;
    const report = calculateHabitability(planet, species);
    if (report.score >= HOME_PLANET_MIN_HABITABILITY) {
      if (best === null || report.score > best.score) {
        best = { planet, score: report.score };
      }
    }
  }

  return best;
}

// ── selectHomeSystem ──────────────────────────────────────────────────────────

/**
 * Selects the best available home system for a species.
 *
 * Rules:
 * - The system must have at least one planet with habitability >= 60.
 * - Systems already taken (or their immediate neighbours) are excluded.
 * - Among valid candidates, return the one with the highest max habitability.
 * - If no candidate passes all filters, relax the neighbour-exclusion rule
 *   (still exclude exact taken systems).
 *
 * Returns the system ID, or null if no suitable system exists.
 */
export function selectHomeSystem(
  galaxy: Galaxy,
  species: Species,
  takenSystemIds: string[],
): string | null {
  const takenSet = new Set(takenSystemIds);

  // Build the set of excluded IDs: taken + their immediate neighbours
  const excludedIds = new Set<string>(takenSystemIds);
  for (const takenId of takenSystemIds) {
    const taken = galaxy.systems.find(s => s.id === takenId);
    if (taken) {
      for (const nb of taken.wormholes) {
        excludedIds.add(nb);
      }
    }
  }

  interface Candidate {
    systemId: string;
    maxHabitability: number;
  }

  const evaluate = (allowExcluded: boolean): Candidate | null => {
    let best: Candidate | null = null;

    for (const system of galaxy.systems) {
      if (takenSet.has(system.id)) continue;
      if (!allowExcluded && excludedIds.has(system.id)) continue;

      const result = bestHabitablePlanet(system, species);
      if (result === null) continue;

      if (best === null || result.score > best.maxHabitability) {
        best = { systemId: system.id, maxHabitability: result.score };
      }
    }

    return best;
  };

  // First pass: strict exclusion (taken + neighbours)
  const strict = evaluate(false);
  if (strict) return strict.systemId;

  // Fallback: only exclude exact taken systems (ignore neighbour buffer)
  const relaxed = evaluate(true);
  return relaxed ? relaxed.systemId : null;
}

// ── createStartingFleet ───────────────────────────────────────────────────────

/**
 * Creates the starting fleet for an empire: 2 Scouts, 1 Destroyer, 1 Transport.
 * Returns immutable Fleet and Ship objects — does not mutate any galaxy state.
 */
export function createStartingFleet(
  empireId: string,
  systemId: string,
  empireName: string,
): { fleet: Fleet; ships: Ship[] } {
  const fleetId = generateId();

  const shipDefs: Array<{ hull: HullClass; name: string }> = [
    { hull: 'scout', name: `${empireName} Scout I` },
    { hull: 'scout', name: `${empireName} Scout II` },
    { hull: 'destroyer', name: `${empireName} Destroyer I` },
    { hull: 'transport', name: `${empireName} Transport I` },
  ];

  const BASE_HULL_POINTS: Record<HullClass, number> = {
    scout: 20,
    destroyer: 60,
    transport: 40,
    cruiser: 120,
    carrier: 200,
    battleship: 300,
  };

  const ships: Ship[] = shipDefs.map(def => {
    const shipId = generateId();
    const hp = BASE_HULL_POINTS[def.hull];
    return {
      id: shipId,
      designId: `starting_${def.hull}`,
      name: def.name,
      hullPoints: hp,
      maxHullPoints: hp,
      systemDamage: {
        engines: 0,
        weapons: 0,
        shields: 0,
        sensors: 0,
        warpDrive: 0,
      },
      position: { systemId },
      fleetId,
    };
  });

  const fleet: Fleet = {
    id: fleetId,
    name: `${empireName} Home Fleet`,
    ships: ships.map(s => s.id),
    empireId,
    position: { systemId },
    destination: null,
    waypoints: [],
    stance: 'defensive',
  };

  return { fleet, ships };
}

// ── initializeGame ────────────────────────────────────────────────────────────

/**
 * Initialises a complete GameState from a setup configuration.
 *
 * Steps per player:
 *   1. Select a home system (maximally spread across the galaxy).
 *   2. Create an Empire with starting resources.
 *   3. Colonise the best planet in that system with starting buildings.
 *   4. Create a starting fleet in the home system.
 *   5. Set fog-of-war: reveal home system + all 1-hop neighbours.
 *
 * Returns a fully initialised GameState ready to run.
 */
export function initializeGame(config: GameSetupConfig): GameState {
  const galaxy = generateGalaxy(config.galaxyConfig);

  const empires: Empire[] = [];
  const allFleets: Fleet[] = [];
  const allShips: Ship[] = [];
  const takenSystemIds: string[] = [];

  // Work on a mutable copy of systems so we can colonise planets
  const systemsById = new Map<string, StarSystem>(
    galaxy.systems.map(s => [s.id, { ...s, planets: [...s.planets] }]),
  );

  for (const playerSetup of config.players) {
    const empireId = generateId();

    // 1. Pick home system
    const homeSystemId = selectHomeSystem(galaxy, playerSetup.species, takenSystemIds);
    if (homeSystemId === null) {
      throw new Error(
        `No suitable home system found for empire "${playerSetup.empireName}". ` +
          `Try a larger galaxy or fewer players.`,
      );
    }
    takenSystemIds.push(homeSystemId);

    const homeSystem = systemsById.get(homeSystemId)!;

    // 2. Pick best habitable planet in home system
    const planetResult = bestHabitablePlanet(homeSystem, playerSetup.species);
    if (planetResult === null) {
      throw new Error(
        `Home system "${homeSystem.name}" has no habitable planet for "${playerSetup.empireName}".`,
      );
    }

    // 3. Colonise that planet with starting buildings
    const startingBuildingTypes: BuildingType[] = [
      'research_lab',
      'factory',
      'population_center',
      'spaceport',
      'mining_facility',
      'power_plant',
    ];

    const startingBuildings: Building[] = startingBuildingTypes.map(type => ({
      id: generateId(),
      type,
      level: 1,
    }));

    const colonisedPlanet: Planet = {
      ...planetResult.planet,
      ownerId: empireId,
      currentPopulation: 1000,
      buildings: startingBuildings,
    };

    // 4. Fog of war: home system + 1 hop
    const knownSystemIds = Array.from(systemsWithinHops(galaxy, homeSystemId, 1));

    // Mark systems as discovered in the working map
    for (const sysId of knownSystemIds) {
      const sys = systemsById.get(sysId);
      if (sys) {
        systemsById.set(sysId, {
          ...sys,
          discovered: { ...sys.discovered, [empireId]: true },
        });
      }
    }

    // Patch the home system's planet list with the colonised planet
    const updatedHomeSystem = systemsById.get(homeSystemId)!;
    const updatedPlanets = updatedHomeSystem.planets.map(p =>
      p.id === colonisedPlanet.id ? colonisedPlanet : p,
    );
    systemsById.set(homeSystemId, {
      ...updatedHomeSystem,
      ownerId: empireId,
      planets: updatedPlanets,
    });

    // 5. Starting resources
    const startingResources: EmpireResources = {
      credits: STARTING_CREDITS,
      minerals: 200,
      rareElements: 0,
      energy: 50,
      organics: 50,
      exoticMaterials: 0,
      faith: 0,
      researchPoints: STARTING_RESEARCH_POINTS,
    };

    // 6. Build empire object
    const empire: Empire = {
      id: empireId,
      name: playerSetup.empireName,
      species: playerSetup.species,
      color: playerSetup.color,
      credits: startingResources.credits,
      researchPoints: startingResources.researchPoints,
      knownSystems: knownSystemIds,
      diplomacy: [],
      technologies: [],
      currentAge: 'diamond_age',
      isAI: playerSetup.isAI,
      ...(playerSetup.aiPersonality !== undefined
        ? { aiPersonality: playerSetup.aiPersonality }
        : {}),
    };

    empires.push(empire);

    // 7. Starting fleet
    const { fleet, ships } = createStartingFleet(empireId, homeSystemId, playerSetup.empireName);
    allFleets.push(fleet);
    allShips.push(...ships);
  }

  // Rebuild galaxy systems from the working map (preserving order)
  const updatedSystems = galaxy.systems.map(s => systemsById.get(s.id) ?? s);
  const updatedGalaxy: Galaxy = { ...galaxy, systems: updatedSystems };

  return {
    id: generateId(),
    galaxy: updatedGalaxy,
    empires,
    fleets: allFleets,
    ships: allShips,
    currentTick: 0,
    speed: 'normal',
    status: 'playing',
  };
}
