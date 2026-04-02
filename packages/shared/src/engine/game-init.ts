/**
 * Empire initialisation and game start logic for Ex Nihilo.
 *
 * Entry point: initializeGame(config) → GameState
 *
 * All functions are pure except initializeGame, which calls generateGalaxy()
 * (deterministic given a seed).
 */

import type { Galaxy, StarSystem, Planet, Building, BuildingType, AtmosphereType } from '../types/galaxy.js';
import type { Empire, Species, AIPersonality } from '../types/species.js';
import type { Fleet, Ship, HullClass } from '../types/ships.js';
import type { EmpireResources } from '../types/resources.js';
import type { GameState, VictoryCriteria } from '../types/game-state.js';
import type { GalaxyGenerationConfig } from '../generation/galaxy-generator.js';
import type { GovernmentType } from '../types/government.js';
import type { DifficultyLevel } from '../types/psychology.js';
import { generateGalaxy } from '../generation/galaxy-generator.js';
import { calculateHabitability } from './colony.js';
import { getIdealPlanetType } from './terraforming.js';
import { generateId } from '../utils/id.js';
import { STARTING_CREDITS, STARTING_RESEARCH_POINTS } from '../constants/game.js';
import { getAbilityFoodModifier } from './economy.js';
import { rollPersonality, createDefaultPersonality } from './psychology/personality.js';
import { SPECIES_PERSONALITIES_BY_ID } from '../../data/species/personality/index.js';

/**
 * Infer an AI personality from the species' traits.  The highest trait
 * drives the personality, so a species with combat 9 will be aggressive
 * while one with diplomacy 8 will be diplomatic.
 */
function inferAIPersonality(species: Species): AIPersonality {
  const t = species.traits;
  const candidates: [AIPersonality, number][] = [
    ['aggressive',   t.combat],
    ['economic',     t.economy],
    ['researcher',   t.research],
    ['diplomatic',   t.diplomacy],
    ['expansionist', t.construction],
  ];
  // Sort descending by trait value; ties broken by order (combat wins ties)
  candidates.sort((a, b) => b[1] - a[1]);
  return candidates[0][0];
}

// ── Public interfaces ─────────────────────────────────────────────────────────

export interface GameSetupConfig {
  galaxyConfig: GalaxyGenerationConfig;
  players: PlayerSetup[];
  /** Which victory conditions are active.  Omit or pass empty to enable all. */
  victoryCriteria?: string[];
  /** Difficulty level affecting AI personality rolling. Defaults to 'normal'. */
  difficulty?: DifficultyLevel;
}

export interface PlayerSetup {
  species: Species;
  empireName: string;
  color: string;
  isAI: boolean;
  aiPersonality?: AIPersonality;
  /** Government type for this empire. Defaults to 'democracy'. */
  government?: GovernmentType;
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
  minHabitability: number = HOME_PLANET_MIN_HABITABILITY,
): { planet: Planet; score: number } | null {
  let best: { planet: Planet; score: number } | null = null;

  for (const planet of system.planets) {
    if (planet.type === 'gas_giant') continue;
    const report = calculateHabitability(planet, species);
    if (report.score >= minHabitability) {
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

  const evaluate = (allowExcluded: boolean, minHab: number): Candidate | null => {
    let best: Candidate | null = null;

    for (const system of galaxy.systems) {
      if (takenSet.has(system.id)) continue;
      if (!allowExcluded && excludedIds.has(system.id)) continue;

      const result = bestHabitablePlanet(system, species, minHab);
      if (result === null) continue;

      if (best === null || result.score > best.maxHabitability) {
        best = { systemId: system.id, maxHabitability: result.score };
      }
    }

    return best;
  };

  // First pass: strict exclusion (taken + neighbours), standard threshold
  const strict = evaluate(false, HOME_PLANET_MIN_HABITABILITY);
  if (strict) return strict.systemId;

  // Second pass: relax neighbour exclusion
  const relaxed = evaluate(true, HOME_PLANET_MIN_HABITABILITY);
  if (relaxed) return relaxed.systemId;

  // Third pass: lower habitability threshold for extreme species (silicon-based,
  // aquatic, etc. may struggle to find planets scoring 60+)
  const lenient = evaluate(true, 20);
  if (lenient) return lenient.systemId;

  // Last resort: accept ANY non-gas-giant planet
  const desperate = evaluate(true, 1);
  return desperate ? desperate.systemId : null;
}

// ── createStartingFleet ───────────────────────────────────────────────────────

/**
 * Creates the starting fleet for an empire: a single Deep Space Probe.
 * Returns immutable Fleet and Ship objects — does not mutate any galaxy state.
 */
export function createStartingFleet(
  empireId: string,
  systemId: string,
  empireName: string,
): { fleet: Fleet; ships: Ship[] } {
  const fleetId = generateId();

  const shipDefs: Array<{ hull: HullClass; name: string }> = [
    { hull: 'deep_space_probe', name: `${empireName} Deep Space Probe I` },
  ];

  const BASE_HULL_POINTS: Record<HullClass, number> = {
    scout: 20,
    destroyer: 60,
    transport: 40,
    cruiser: 120,
    carrier: 200,
    battleship: 300,
    coloniser: 60,
    dreadnought: 600,
    battle_station: 800,
    deep_space_probe: 10,
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
    name: `1st ${empireName} Expeditionary Fleet`,
    ships: ships.map(s => s.id),
    empireId,
    position: { systemId },
    destination: null,
    waypoints: [],
    stance: 'defensive',
    orbitTarget: 'star',
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

  // ── Guaranteed home planets ────────────────────────────────────────────────
  // Ensure at least one suitable planet exists per player species.  Without
  // this, exotic species (volcanic, ice-loving, etc.) may find zero planets
  // scoring >= 40 habitability in a randomly generated galaxy.
  for (const playerSetup of config.players) {
    const hasGoodPlanet = galaxy.systems.some(sys =>
      sys.planets.some(p => {
        if (p.type === 'gas_giant') return false;
        return calculateHabitability(p, playerSetup.species).score >= 40;
      }),
    );

    if (!hasGoodPlanet) {
      const targetType = getIdealPlanetType(playerSetup.species.environmentPreference);
      const targetAtmo = (playerSetup.species.environmentPreference.preferredAtmospheres[0]
        ?? 'oxygen_nitrogen') as AtmosphereType;
      const targetTemp = playerSetup.species.environmentPreference.idealTemperature;
      const targetGrav = playerSetup.species.environmentPreference.idealGravity;

      // Pick a random system with a non-gas-giant planet and convert it.
      for (const sys of galaxy.systems) {
        const planet = sys.planets.find(p => p.type !== 'gas_giant');
        if (planet) {
          planet.type = targetType;
          planet.atmosphere = targetAtmo;
          planet.temperature = targetTemp;
          planet.gravity = targetGrav;
          break;
        }
      }
    }
  }
  // ── End guaranteed home planets ────────────────────────────────────────────

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
      // Caller must check for error result — the UI layer (GameSetupScreen)
      // should validate player count vs galaxy size before reaching this point.
      throw new Error(
        `Could not find a suitable home system for "${playerSetup.empireName}". ` +
          `The galaxy is too small for ${config.players.length} players — ` +
          `please choose a larger galaxy size or reduce the number of players.`,
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

    // Home world fertility boost — a species' home planet must have above-
    // average fertility (life evolved here for millions of years).  This also
    // prevents starting the game in immediate starvation.
    const homePlanet = planetResult.planet;
    const boostedFertility = Math.max(50, homePlanet.fertility ?? 50);

    // 3. Colonise that planet with starting buildings.
    // High-consumption species (modifier > 1.0×) get extra food buildings
    // representing centuries of pre-spaceflight agricultural development.
    // A species that eats 40% more than baseline would have built extensive
    // food infrastructure long before achieving spaceflight.
    const foodModifier = getAbilityFoodModifier(playerSetup.species.specialAbilities)
      * (playerSetup.species.traits.reproduction / 5);

    const startingBuildingTypes: BuildingType[] = [
      'research_lab',
      'factory',
      'population_center',
      'spaceport',
      'mining_facility',
      'power_plant',
      'hydroponics_bay',
      'shipyard',
    ];

    // Starting population must be what the planet can actually sustain.
    // Natural food production covers (fertility/100) × maxPop people at a
    // base rate. High-consumption species (reproduction trait > 5) eat more,
    // so fewer people can be fed by the same ecosystem. Starting buildings
    // (hydroponics etc.) provide a small buffer but the population must not
    // exceed what natural food + starting buildings can sustain.
    //
    // A civilisation doesn't fill a planet to capacity before spaceflight —
    // they grow to what the land can feed and expand from there.
    const naturalCapacity = Math.floor((boostedFertility / 100) * homePlanet.maxPopulation);

    // Starting population: the number of people the land can naturally feed.
    //
    // The planet produces food based on its fertility (naturalCap / 10M organics).
    // The species consumes (pop / 10M × foodModifier) organics.
    // Break-even: naturalCap / 10M = pop / 10M × foodModifier
    //           → pop = naturalCap / foodModifier
    //
    // Start at 85% of the sustainable population to provide a small food
    // surplus from starting buildings. High-reproduction species start with
    // fewer people but grow faster — a natural biological tradeoff.
    //
    // Examples on a 75% fertility, 8B max planet (naturalCap = 6B):
    //   Teranos (repro 5, mod 1.0): 5.1B — comfortable surplus
    //   Sylvani (repro 8, mod 1.6): 3.2B — smaller but growing fast
    //   Nexari  (repro 2, mod 0.4): 6.0B — capped at naturalCap (huge surplus)
    const sustainablePopulation = Math.floor(naturalCapacity / Math.max(foodModifier, 0.1));
    const startingPopulation = Math.max(
      1_000_000,
      Math.min(Math.floor(sustainablePopulation * 0.85), naturalCapacity),
    );

    const startingBuildings: Building[] = startingBuildingTypes.map(type => ({
      id: generateId(),
      type,
      level: 1,
    }));

    const colonisedPlanet: Planet = {
      ...homePlanet,
      fertility: boostedFertility,
      ownerId: empireId,
      currentPopulation: startingPopulation,
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

    // 6. Roll per-game psychology from species personality data
    const difficulty = config.difficulty ?? 'normal';
    const speciesPersonality = SPECIES_PERSONALITIES_BY_ID[playerSetup.species.id];
    const psychology = speciesPersonality
      ? rollPersonality(speciesPersonality, difficulty)
      : createDefaultPersonality(playerSetup.species.id);

    // 7. Build empire object
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
      currentAge: 'nano_atomic',
      isAI: playerSetup.isAI,
      government: playerSetup.government ?? playerSetup.species.defaultGovernment ?? 'democracy',
      // AI personality: explicit > inferred from species traits > defensive fallback.
      // Trait-based inference means combat-focused species (Drakmari, Khazari) will
      // actually pursue war, while diplomatic species (Vethara, Teranos) seek alliances.
      aiPersonality: playerSetup.aiPersonality
        ?? (playerSetup.isAI ? inferAIPersonality(playerSetup.species) : undefined),
      psychology,
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
    ...(config.victoryCriteria && config.victoryCriteria.length > 0
      ? { victoryCriteria: config.victoryCriteria as VictoryCriteria[] }
      : {}),
  };
}
