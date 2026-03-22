import { describe, it, expect } from 'vitest';
import {
  evaluateEmpireState,
  generateAIDecisions,
  evaluateColonizationTargets,
  evaluateResearchPriority,
  evaluateMilitaryActions,
  evaluateEconomicActions,
  evaluateDiplomaticActions,
  evaluateBuildingPriority,
  selectTopDecisions,
  type AIDecision,
  type AIEvaluation,
} from '../engine/ai.js';
import type { Empire, Species } from '../types/species.js';
import type { Galaxy, StarSystem, Planet, Building } from '../types/galaxy.js';
import type { Fleet, Ship } from '../types/ships.js';
import type { GameState } from '../types/game-state.js';
import type { ResearchState } from '../engine/research.js';
import type { Technology } from '../types/technology.js';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

function makeSpecies(overrides: Partial<Species> = {}): Species {
  return {
    id: 'humans',
    name: 'Humans',
    description: 'Test species',
    portrait: 'human',
    isPrebuilt: true,
    specialAbilities: [],
    environmentPreference: {
      idealTemperature: 295,
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
    },
    ...overrides,
  };
}

function makePlanet(overrides: Partial<Planet> = {}): Planet {
  return {
    id: 'planet-1',
    name: 'New Earth',
    orbitalIndex: 2,
    type: 'terran',
    atmosphere: 'oxygen_nitrogen',
    gravity: 1.0,
    temperature: 295,
    naturalResources: 60,
    maxPopulation: 100,
    // Default to 0 so canColonize() allows unowned planets to be colonized.
    // Use ownerId + non-zero population in tests that need an established colony.
    currentPopulation: 0,
    ownerId: null,
    buildings: [],
    productionQueue: [],
    ...overrides,
  };
}

function makeSystem(overrides: Partial<StarSystem> = {}): StarSystem {
  return {
    id: 'sys-1',
    name: 'Sol',
    position: { x: 0, y: 0 },
    starType: 'yellow',
    planets: [],
    wormholes: [],
    ownerId: null,
    discovered: {},
    ...overrides,
  };
}

function makeGalaxy(systems: StarSystem[]): Galaxy {
  return {
    id: 'galaxy-1',
    systems,
    anomalies: [],
    minorSpecies: [],
    width: 1000,
    height: 1000,
    seed: 42,
  };
}

function makeEmpire(overrides: Partial<Empire> = {}): Empire {
  const species = makeSpecies();
  return {
    id: 'empire-1',
    name: 'Test Empire',
    species,
    color: '#0000ff',
    credits: 500,
    researchPoints: 0,
    knownSystems: ['sys-1'],
    diplomacy: [],
    technologies: [],
    currentAge: 'nano_atomic',
    isAI: true,
    aiPersonality: 'defensive',
    government: 'democracy',
    ...overrides,
  };
}

function makeShip(overrides: Partial<Ship> = {}): Ship {
  return {
    id: 'ship-1',
    designId: 'design-1',
    name: 'Test Ship',
    hullPoints: 100,
    maxHullPoints: 100,
    systemDamage: { engines: 0, weapons: 0, shields: 0, sensors: 0, warpDrive: 0 },
    position: { systemId: 'sys-1' },
    fleetId: 'fleet-1',
    ...overrides,
  };
}

function makeFleet(overrides: Partial<Fleet> = {}): Fleet {
  return {
    id: 'fleet-1',
    name: 'Alpha Fleet',
    ships: ['ship-1'],
    empireId: 'empire-1',
    position: { systemId: 'sys-1' },
    destination: null,
    waypoints: [],
    stance: 'defensive',
    ...overrides,
  };
}

function makeGameState(
  galaxy: Galaxy,
  empires: Empire[],
  fleets: Fleet[] = [],
  ships: Ship[] = [],
): GameState {
  return {
    id: 'game-1',
    galaxy,
    empires,
    fleets,
    ships,
    currentTick: 1,
    speed: 'normal',
    status: 'playing',
  };
}

function makeTech(overrides: Partial<Technology> = {}): Technology {
  return {
    id: 'tech-weapons-1',
    name: 'Basic Weapons',
    description: 'Improved ship weapons',
    category: 'weapons',
    age: 'nano_atomic',
    cost: 100,
    prerequisites: [],
    effects: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// evaluateEmpireState
// ---------------------------------------------------------------------------

describe('evaluateEmpireState', () => {
  it('returns meaningful metrics for a simple empire', () => {
    const planet = makePlanet({ ownerId: 'empire-1', id: 'p1', currentPopulation: 20 });
    const system = makeSystem({ id: 'sys-1', planets: [planet], ownerId: 'empire-1' });
    const galaxy = makeGalaxy([system]);
    const empire = makeEmpire({ knownSystems: ['sys-1'] });
    const fleet = makeFleet({ empireId: 'empire-1' });
    const ship = makeShip({ fleetId: 'fleet-1' });

    const eval_ = evaluateEmpireState(empire, galaxy, [fleet], [ship]);

    expect(eval_.empireId).toBe('empire-1');
    expect(eval_.militaryPower).toBeGreaterThan(0);
    expect(eval_.economicPower).toBeGreaterThan(0);
    expect(eval_.techLevel).toBe(0); // no technologies researched
  });

  it('military power increases with more ships', () => {
    const galaxy = makeGalaxy([makeSystem()]);
    const empire = makeEmpire();
    const ship1 = makeShip({ id: 'ship-1', hullPoints: 100 });
    const ship2 = makeShip({ id: 'ship-2', hullPoints: 100, fleetId: 'fleet-1' });
    const fleet = makeFleet({ ships: ['ship-1', 'ship-2'] });

    const evalOne = evaluateEmpireState(empire, galaxy, [makeFleet({ ships: ['ship-1'] })], [ship1]);
    const evalTwo = evaluateEmpireState(empire, galaxy, [fleet], [ship1, ship2]);

    expect(evalTwo.militaryPower).toBeGreaterThan(evalOne.militaryPower);
  });

  it('threat assessment marks at-war empire as high threat', () => {
    const galaxy = makeGalaxy([makeSystem()]);
    const empire = makeEmpire({
      diplomacy: [
        { empireId: 'enemy-1', status: 'at_war', treaties: [], attitude: -80, tradeRoutes: 0 },
      ],
    });

    const enemyFleet = makeFleet({ id: 'fleet-e', empireId: 'enemy-1', ships: ['ship-e'] });
    const enemyShip = makeShip({ id: 'ship-e', fleetId: 'fleet-e' });
    const ownFleet = makeFleet({ ships: ['ship-1'] });
    const ownShip = makeShip();

    const eval_ = evaluateEmpireState(empire, galaxy, [ownFleet, enemyFleet], [ownShip, enemyShip]);
    const threat = eval_.threatAssessment.get('enemy-1');

    expect(threat).toBeDefined();
    expect(threat!).toBeGreaterThan(30); // at-war adds significant threat
  });

  it('allied empire has low threat', () => {
    const galaxy = makeGalaxy([makeSystem()]);
    const empire = makeEmpire({
      diplomacy: [
        { empireId: 'ally-1', status: 'allied', treaties: [], attitude: 80, tradeRoutes: 2 },
      ],
    });
    const allyFleet = makeFleet({ id: 'fleet-a', empireId: 'ally-1', ships: ['ship-a'] });
    const allyShip = makeShip({ id: 'ship-a', fleetId: 'fleet-a' });

    const eval_ = evaluateEmpireState(empire, galaxy, [allyFleet], [allyShip]);
    const threat = eval_.threatAssessment.get('ally-1');

    // Allied empire should have low or zero threat (diplomatic modifier is -10)
    expect(threat ?? 0).toBeLessThan(30);
  });
});

// ---------------------------------------------------------------------------
// evaluateColonizationTargets
// ---------------------------------------------------------------------------

describe('evaluateColonizationTargets', () => {
  it('returns decisions for colonizable planets in known systems', () => {
    const planet = makePlanet({ id: 'p1', ownerId: null });
    const system = makeSystem({ id: 'sys-1', planets: [planet] });
    const galaxy = makeGalaxy([system]);
    const empire = makeEmpire({ knownSystems: ['sys-1'] });

    const decisions = evaluateColonizationTargets(empire, galaxy, empire.species);
    expect(decisions.length).toBeGreaterThan(0);
    expect(decisions[0]!.type).toBe('colonize');
  });

  it('ignores planets in unknown systems', () => {
    const planet = makePlanet({ id: 'p-unknown', ownerId: null });
    const system = makeSystem({ id: 'sys-unknown', planets: [planet] });
    const galaxy = makeGalaxy([system]);
    const empire = makeEmpire({ knownSystems: [] }); // knows nothing

    const decisions = evaluateColonizationTargets(empire, galaxy, empire.species);
    expect(decisions).toHaveLength(0);
  });

  it('ignores already-owned planets', () => {
    const ownedPlanet = makePlanet({ id: 'p-owned', ownerId: 'another-empire' });
    const system = makeSystem({ id: 'sys-1', planets: [ownedPlanet] });
    const galaxy = makeGalaxy([system]);
    const empire = makeEmpire({ knownSystems: ['sys-1'] });

    const decisions = evaluateColonizationTargets(empire, galaxy, empire.species);
    expect(decisions).toHaveLength(0);
  });

  it('ranks higher-habitability planets with higher priority', () => {
    const goodPlanet = makePlanet({
      id: 'p-good',
      ownerId: null,
      atmosphere: 'oxygen_nitrogen',
      gravity: 1.0,
      temperature: 295,
      naturalResources: 80,
    });
    const badPlanet = makePlanet({
      id: 'p-bad',
      ownerId: null,
      atmosphere: 'ammonia',
      gravity: 2.5,
      temperature: 500,
      naturalResources: 10,
    });
    const system = makeSystem({ id: 'sys-1', planets: [goodPlanet, badPlanet] });
    const galaxy = makeGalaxy([system]);
    const empire = makeEmpire({ knownSystems: ['sys-1'] });

    const decisions = evaluateColonizationTargets(empire, galaxy, empire.species);
    const goodDecision = decisions.find(d => d.params['planetId'] === 'p-good');
    const badDecision = decisions.find(d => d.params['planetId'] === 'p-bad');

    // Good planet should have strictly higher priority
    if (goodDecision && badDecision) {
      expect(goodDecision.priority).toBeGreaterThan(badDecision.priority);
    }
  });
});

// ---------------------------------------------------------------------------
// evaluateResearchPriority
// ---------------------------------------------------------------------------

describe('evaluateResearchPriority', () => {
  const baseResearchState: ResearchState = {
    completedTechs: [],
    activeResearch: [],
    currentAge: 'nano_atomic',
    totalResearchGenerated: 0,
  };

  it('returns a decision for each available tech', () => {
    const techs: Technology[] = [
      makeTech({ id: 'w1', category: 'weapons' }),
      makeTech({ id: 'c1', category: 'construction' }),
    ];
    const empire = makeEmpire();
    const decisions = evaluateResearchPriority(empire, baseResearchState, 'aggressive', techs);
    expect(decisions).toHaveLength(2);
    expect(decisions.every(d => d.type === 'research')).toBe(true);
  });

  it('aggressive AI gives higher priority to weapons tech', () => {
    const techs: Technology[] = [
      makeTech({ id: 'w1', name: 'Weapons', category: 'weapons', cost: 100 }),
      makeTech({ id: 'b1', name: 'Biology', category: 'biology', cost: 100 }),
    ];
    const empire = makeEmpire();
    const decisions = evaluateResearchPriority(empire, baseResearchState, 'aggressive', techs);

    const weaponsDec = decisions.find(d => d.params['techId'] === 'w1')!;
    const biologyDec = decisions.find(d => d.params['techId'] === 'b1')!;

    expect(weaponsDec.priority).toBeGreaterThan(biologyDec.priority);
  });

  it('researcher AI gives highest priority to research techs', () => {
    const techs: Technology[] = [
      makeTech({ id: 's1', name: 'Racial Tech', category: 'racial', cost: 100 }),
      makeTech({ id: 'w1', name: 'Weapons', category: 'weapons', cost: 100 }),
    ];
    const empire = makeEmpire();
    const decisions = evaluateResearchPriority(empire, baseResearchState, 'researcher', techs);

    // For researcher: all categories are preferred, so everything should be in the preferred list
    expect(decisions.length).toBeGreaterThan(0);
    expect(decisions.every(d => d.priority > 30)).toBe(true);
  });

  it('economic AI gives higher priority to construction tech', () => {
    const techs: Technology[] = [
      makeTech({ id: 'c1', name: 'Construction', category: 'construction', cost: 100 }),
      makeTech({ id: 'w1', name: 'Weapons', category: 'weapons', cost: 100 }),
    ];
    const empire = makeEmpire();
    const decisions = evaluateResearchPriority(empire, baseResearchState, 'economic', techs);

    const constructionDec = decisions.find(d => d.params['techId'] === 'c1')!;
    const weaponsDec = decisions.find(d => d.params['techId'] === 'w1')!;

    expect(constructionDec.priority).toBeGreaterThan(weaponsDec.priority);
  });

  it('returns empty array when no techs are available', () => {
    const empire = makeEmpire();
    const decisions = evaluateResearchPriority(empire, baseResearchState, 'researcher', []);
    expect(decisions).toHaveLength(0);
  });

  it('does not suggest already-researched techs', () => {
    const tech = makeTech({ id: 'w1' });
    const stateWithCompleted: ResearchState = {
      ...baseResearchState,
      completedTechs: ['w1'],
    };
    const empire = makeEmpire();
    const decisions = evaluateResearchPriority(empire, stateWithCompleted, 'aggressive', [tech]);
    expect(decisions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// evaluateMilitaryActions
// ---------------------------------------------------------------------------

describe('evaluateMilitaryActions', () => {
  it('suggests scouting when unexplored systems are adjacent', () => {
    const knownSystem = makeSystem({
      id: 'sys-known',
      wormholes: ['sys-unknown'],
    });
    const unknownSystem = makeSystem({ id: 'sys-unknown' });
    const galaxy = makeGalaxy([knownSystem, unknownSystem]);
    const empire = makeEmpire({ knownSystems: ['sys-known'] });
    const fleet = makeFleet({ position: { systemId: 'sys-known' } });
    const ship = makeShip();

    const fakeEval: AIEvaluation = {
      empireId: 'empire-1',
      militaryPower: 200,
      economicPower: 50,
      techLevel: 10,
      expansionPotential: 30,
      threatAssessment: new Map(),
    };

    const decisions = evaluateMilitaryActions(empire, galaxy, [fleet], [ship], fakeEval);
    const scout = decisions.find(d => d.params['purpose'] === 'scout');
    expect(scout).toBeDefined();
    expect(scout!.type).toBe('move_fleet');
  });

  it('suggests war against weakest enemy when aggressive and strong', () => {
    const galaxy = makeGalaxy([makeSystem()]);
    const empire = makeEmpire({
      aiPersonality: 'aggressive',
      diplomacy: [
        { empireId: 'weak-enemy', status: 'neutral', treaties: [], attitude: -20, tradeRoutes: 0 },
      ],
    });
    const fleet = makeFleet({ empireId: 'empire-1' });
    const ship = makeShip();

    const strongEval: AIEvaluation = {
      empireId: 'empire-1',
      militaryPower: 1000,
      economicPower: 50,
      techLevel: 10,
      expansionPotential: 20,
      threatAssessment: new Map([['weak-enemy', 25]]),
    };

    const decisions = evaluateMilitaryActions(empire, galaxy, [fleet], [ship], strongEval);
    const warDecision = decisions.find(d => d.type === 'war');
    expect(warDecision).toBeDefined();
    expect(warDecision!.params['targetEmpireId']).toBe('weak-enemy');
  });

  it('returns no decisions when empire has no fleets', () => {
    const galaxy = makeGalaxy([makeSystem()]);
    const empire = makeEmpire();
    const fakeEval: AIEvaluation = {
      empireId: 'empire-1',
      militaryPower: 0,
      economicPower: 20,
      techLevel: 5,
      expansionPotential: 10,
      threatAssessment: new Map(),
    };

    const decisions = evaluateMilitaryActions(empire, galaxy, [], [], fakeEval);
    expect(decisions).toHaveLength(0);
  });

  it('focuses on strongest threat in defensive mode (reinforce border)', () => {
    const ownSystem = makeSystem({
      id: 'sys-own',
      ownerId: 'empire-1',
      wormholes: ['sys-enemy'],
    });
    const enemySystem = makeSystem({
      id: 'sys-enemy',
      ownerId: 'threat-empire',
    });
    const galaxy = makeGalaxy([ownSystem, enemySystem]);
    const empire = makeEmpire({
      aiPersonality: 'defensive',
      knownSystems: ['sys-own', 'sys-enemy'],
      diplomacy: [
        { empireId: 'threat-empire', status: 'hostile', treaties: [], attitude: -50, tradeRoutes: 0 },
      ],
    });
    const fleet = makeFleet({ position: { systemId: 'sys-own' } });
    const ship = makeShip();

    const eval_: AIEvaluation = {
      empireId: 'empire-1',
      militaryPower: 200,
      economicPower: 30,
      techLevel: 5,
      expansionPotential: 10,
      threatAssessment: new Map([['threat-empire', 60]]),
    };

    const decisions = evaluateMilitaryActions(empire, galaxy, [fleet], [ship], eval_);
    const reinforce = decisions.find(d => d.params['purpose'] === 'reinforce');
    expect(reinforce).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// evaluateEconomicActions
// ---------------------------------------------------------------------------

describe('evaluateEconomicActions', () => {
  it('suggests factories for resource-rich planets', () => {
    const planet = makePlanet({
      id: 'p1',
      ownerId: 'empire-1',
      naturalResources: 70,
      currentPopulation: 5,
      buildings: [],
    });
    const system = makeSystem({ id: 'sys-1', planets: [planet] });
    const galaxy = makeGalaxy([system]);
    const empire = makeEmpire({ credits: 1000 });

    const decisions = evaluateEconomicActions(empire, galaxy);
    const factory = decisions.find(d => d.params['buildingType'] === 'factory');
    expect(factory).toBeDefined();
  });

  it('suggests trade hubs for populous planets', () => {
    const planet = makePlanet({
      id: 'p1',
      ownerId: 'empire-1',
      currentPopulation: 20,
      buildings: [],
    });
    const system = makeSystem({ id: 'sys-1', planets: [planet] });
    const galaxy = makeGalaxy([system]);
    const empire = makeEmpire({ credits: 1000 });

    const decisions = evaluateEconomicActions(empire, galaxy);
    const tradeHub = decisions.find(d => d.params['buildingType'] === 'trade_hub');
    expect(tradeHub).toBeDefined();
  });

  it('does not suggest buildings the empire cannot afford', () => {
    const planet = makePlanet({
      id: 'p1',
      ownerId: 'empire-1',
      naturalResources: 70,
      currentPopulation: 20,
    });
    const system = makeSystem({ id: 'sys-1', planets: [planet] });
    const galaxy = makeGalaxy([system]);
    const brokeEmpire = makeEmpire({ credits: 0 }); // can't afford anything

    const decisions = evaluateEconomicActions(brokeEmpire, galaxy);
    expect(decisions).toHaveLength(0);
  });

  it('does not suggest buildings already built', () => {
    const factory: Building = { id: 'b1', type: 'factory', level: 1 };
    const planet = makePlanet({
      id: 'p1',
      ownerId: 'empire-1',
      naturalResources: 80,
      currentPopulation: 20,
      buildings: [factory],
    });
    const system = makeSystem({ id: 'sys-1', planets: [planet] });
    const galaxy = makeGalaxy([system]);
    const empire = makeEmpire({ credits: 1000 });

    const decisions = evaluateEconomicActions(empire, galaxy);
    const factoryDec = decisions.find(d => d.params['buildingType'] === 'factory');
    expect(factoryDec).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// evaluateDiplomaticActions
// ---------------------------------------------------------------------------

describe('evaluateDiplomaticActions', () => {
  it('diplomatic AI proposes trade treaties broadly', () => {
    const empire = makeEmpire({
      aiPersonality: 'diplomatic',
      diplomacy: [
        { empireId: 'other-1', status: 'neutral', treaties: [], attitude: 0, tradeRoutes: 0 },
      ],
    });
    const eval_: AIEvaluation = {
      empireId: 'empire-1',
      militaryPower: 100,
      economicPower: 50,
      techLevel: 5,
      expansionPotential: 20,
      threatAssessment: new Map([['other-1', 15]]),
    };

    const decisions = evaluateDiplomaticActions(empire, eval_, 'diplomatic');
    const tradeDec = decisions.find(d => d.params['treatyType'] === 'trade');
    expect(tradeDec).toBeDefined();
  });

  it('defensive AI seeks non-aggression with high-threat neighbours', () => {
    const empire = makeEmpire({
      aiPersonality: 'defensive',
      diplomacy: [
        { empireId: 'strong-1', status: 'neutral', treaties: [], attitude: -10, tradeRoutes: 0 },
      ],
    });
    const eval_: AIEvaluation = {
      empireId: 'empire-1',
      militaryPower: 50,
      economicPower: 30,
      techLevel: 5,
      expansionPotential: 10,
      threatAssessment: new Map([['strong-1', 65]]),
    };

    const decisions = evaluateDiplomaticActions(empire, eval_, 'defensive');
    const noAggDec = decisions.find(d => d.params['treatyType'] === 'non_aggression');
    expect(noAggDec).toBeDefined();
  });

  it('aggressive AI avoids diplomacy under normal threat levels', () => {
    const empire = makeEmpire({
      aiPersonality: 'aggressive',
      diplomacy: [
        { empireId: 'other-1', status: 'neutral', treaties: [], attitude: -5, tradeRoutes: 0 },
      ],
    });
    const eval_: AIEvaluation = {
      empireId: 'empire-1',
      militaryPower: 500,
      economicPower: 50,
      techLevel: 5,
      expansionPotential: 20,
      threatAssessment: new Map([['other-1', 20]]),
    };

    const decisions = evaluateDiplomaticActions(empire, eval_, 'aggressive');
    // Aggressive with only one low-threat enemy should produce no diplomacy
    expect(decisions).toHaveLength(0);
  });

  it('skips at-war empires for treaty proposals', () => {
    const empire = makeEmpire({
      diplomacy: [
        { empireId: 'enemy-1', status: 'at_war', treaties: [], attitude: -100, tradeRoutes: 0 },
      ],
    });
    const eval_: AIEvaluation = {
      empireId: 'empire-1',
      militaryPower: 100,
      economicPower: 50,
      techLevel: 5,
      expansionPotential: 10,
      threatAssessment: new Map([['enemy-1', 80]]),
    };

    const decisions = evaluateDiplomaticActions(empire, eval_, 'diplomatic');
    // Even diplomatic AI won't propose treaties with at-war empires
    const enemyDec = decisions.find(d => d.params['targetEmpireId'] === 'enemy-1');
    expect(enemyDec).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// evaluateBuildingPriority
// ---------------------------------------------------------------------------

describe('evaluateBuildingPriority', () => {
  it('defensive AI prioritizes defense_grid (when spaceport exists)', () => {
    const spaceport: Building = { id: 'b-sp', type: 'spaceport', level: 1 };
    const planet = makePlanet({
      id: 'p1',
      ownerId: 'empire-1',
      buildings: [spaceport],
    });
    const empire = makeEmpire({ credits: 2000 });

    const decisions = evaluateBuildingPriority(empire, [planet], 'defensive');
    const defenseGrid = decisions.find(d => d.params['buildingType'] === 'defense_grid');
    expect(defenseGrid).toBeDefined();
  });

  it('economic AI prioritizes trade_hub', () => {
    const planet = makePlanet({ id: 'p1', ownerId: 'empire-1', buildings: [] });
    const empire = makeEmpire({ credits: 2000 });

    const decisions = evaluateBuildingPriority(empire, [planet], 'economic');
    const tradeHub = decisions.find(d => d.params['buildingType'] === 'trade_hub');
    expect(tradeHub).toBeDefined();
  });

  it('researcher AI prioritizes research_lab', () => {
    const planet = makePlanet({ id: 'p1', ownerId: 'empire-1', buildings: [] });
    const empire = makeEmpire({ credits: 2000 });

    const decisions = evaluateBuildingPriority(empire, [planet], 'researcher');
    const researchLab = decisions.find(d => d.params['buildingType'] === 'research_lab');
    expect(researchLab).toBeDefined();
  });

  it('does not suggest buildings empire cannot afford', () => {
    const planet = makePlanet({ id: 'p1', ownerId: 'empire-1', buildings: [] });
    const brokeEmpire = makeEmpire({ credits: 0 });

    const decisions = evaluateBuildingPriority(brokeEmpire, [planet], 'economic');
    expect(decisions).toHaveLength(0);
  });

  it('does not suggest buildings already built', () => {
    const tradeHub: Building = { id: 'b1', type: 'trade_hub', level: 1 };
    const planet = makePlanet({
      id: 'p1',
      ownerId: 'empire-1',
      buildings: [tradeHub],
    });
    const empire = makeEmpire({ credits: 2000 });

    const decisions = evaluateBuildingPriority(empire, [planet], 'economic');
    const tradeHubDec = decisions.find(d => d.params['buildingType'] === 'trade_hub');
    expect(tradeHubDec).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// generateAIDecisions
// ---------------------------------------------------------------------------

describe('generateAIDecisions', () => {
  it('aggressive AI produces higher-priority military decisions than economic', () => {
    const planet = makePlanet({
      id: 'p1',
      ownerId: 'empire-1',
      naturalResources: 70,
      currentPopulation: 20,
    });
    const system = makeSystem({ id: 'sys-1', planets: [planet], ownerId: 'empire-1' });
    const galaxy = makeGalaxy([system]);
    const empire = makeEmpire({ aiPersonality: 'aggressive', credits: 1000 });
    const gameState = makeGameState(galaxy, [empire]);

    const eval_: AIEvaluation = {
      empireId: 'empire-1',
      militaryPower: 0,
      economicPower: 30,
      techLevel: 0,
      expansionPotential: 0,
      threatAssessment: new Map(),
    };

    const decisions = generateAIDecisions(empire, gameState, 'aggressive', eval_);
    expect(decisions.length).toBeGreaterThan(0);

    // Results should be sorted by priority (highest first)
    for (let i = 1; i < decisions.length; i++) {
      expect(decisions[i]!.priority).toBeLessThanOrEqual(decisions[i - 1]!.priority);
    }
  });

  it('expansionist AI prioritizes colonization', () => {
    const colonyPlanet = makePlanet({ id: 'p-colony', ownerId: null });
    const homePlanet = makePlanet({ id: 'p-home', ownerId: 'empire-1' });
    const system = makeSystem({
      id: 'sys-1',
      planets: [homePlanet, colonyPlanet],
      ownerId: 'empire-1',
    });
    const galaxy = makeGalaxy([system]);
    const empire = makeEmpire({
      aiPersonality: 'expansionist',
      knownSystems: ['sys-1'],
      credits: 500,
    });
    const gameState = makeGameState(galaxy, [empire]);

    const eval_: AIEvaluation = {
      empireId: 'empire-1',
      militaryPower: 0,
      economicPower: 20,
      techLevel: 0,
      expansionPotential: 80,
      threatAssessment: new Map(),
    };

    const decisions = generateAIDecisions(empire, gameState, 'expansionist', eval_);
    const colonizeDecs = decisions.filter(d => d.type === 'colonize');
    expect(colonizeDecs.length).toBeGreaterThan(0);
  });

  it('researcher AI generates research decisions', () => {
    const planet = makePlanet({ id: 'p1', ownerId: 'empire-1' });
    const system = makeSystem({ id: 'sys-1', planets: [planet], ownerId: 'empire-1' });
    const galaxy = makeGalaxy([system]);
    const empire = makeEmpire({ aiPersonality: 'researcher' });
    const gameState = makeGameState(galaxy, [empire]);
    const techs: Technology[] = [
      makeTech({ id: 's1', category: 'racial' }),
      makeTech({ id: 'c1', category: 'construction' }),
    ];

    const eval_: AIEvaluation = {
      empireId: 'empire-1',
      militaryPower: 0,
      economicPower: 20,
      techLevel: 0,
      expansionPotential: 10,
      threatAssessment: new Map(),
    };

    const decisions = generateAIDecisions(empire, gameState, 'researcher', eval_, techs);
    const researchDecs = decisions.filter(d => d.type === 'research');
    expect(researchDecs.length).toBeGreaterThan(0);

    // Research decisions should be high priority for researcher
    const topResearch = researchDecs[0]!;
    const topBuild = decisions.filter(d => d.type === 'build')[0];
    if (topBuild) {
      expect(topResearch.priority).toBeGreaterThanOrEqual(topBuild.priority);
    }
  });

  it('decisions are sorted by priority (highest first)', () => {
    const system = makeSystem({ id: 'sys-1' });
    const galaxy = makeGalaxy([system]);
    const empire = makeEmpire({ credits: 1000 });
    const gameState = makeGameState(galaxy, [empire]);

    const eval_: AIEvaluation = {
      empireId: 'empire-1',
      militaryPower: 0,
      economicPower: 20,
      techLevel: 0,
      expansionPotential: 10,
      threatAssessment: new Map(),
    };

    const decisions = generateAIDecisions(empire, gameState, 'defensive', eval_);

    for (let i = 1; i < decisions.length; i++) {
      expect(decisions[i]!.priority).toBeLessThanOrEqual(decisions[i - 1]!.priority);
    }
  });
});

// ---------------------------------------------------------------------------
// selectTopDecisions
// ---------------------------------------------------------------------------

describe('selectTopDecisions', () => {
  it('returns up to maxDecisions decisions', () => {
    const decisions: AIDecision[] = Array.from({ length: 10 }, (_, i) => ({
      type: 'build' as const,
      priority: 100 - i * 5,
      params: { planetId: `planet-${i}` },
      reasoning: `Build on planet ${i}`,
    }));

    const top3 = selectTopDecisions(decisions, 3);
    expect(top3).toHaveLength(3);
  });

  it('preserves priority order', () => {
    const decisions: AIDecision[] = [
      { type: 'colonize', priority: 90, params: { planetId: 'p1' }, reasoning: 'a' },
      { type: 'build', priority: 70, params: { planetId: 'p2' }, reasoning: 'b' },
      { type: 'research', priority: 50, params: { techId: 't1' }, reasoning: 'c' },
    ];

    const top = selectTopDecisions(decisions, 5);
    expect(top[0]!.priority).toBe(90);
    expect(top[1]!.priority).toBe(70);
    expect(top[2]!.priority).toBe(50);
  });

  it('deduplicates decisions with the same type + target', () => {
    const decisions: AIDecision[] = [
      { type: 'colonize', priority: 90, params: { planetId: 'p1' }, reasoning: 'first' },
      { type: 'colonize', priority: 80, params: { planetId: 'p1' }, reasoning: 'duplicate' },
      { type: 'build', priority: 70, params: { planetId: 'p2' }, reasoning: 'unique' },
    ];

    const top = selectTopDecisions(decisions, 5);
    const colonize = top.filter(d => d.type === 'colonize' && d.params['planetId'] === 'p1');
    expect(colonize).toHaveLength(1);
    expect(colonize[0]!.reasoning).toBe('first'); // higher priority kept
  });

  it('handles empty input gracefully', () => {
    const top = selectTopDecisions([], 5);
    expect(top).toHaveLength(0);
  });

  it('returns all decisions when count < maxDecisions', () => {
    const decisions: AIDecision[] = [
      { type: 'research', priority: 60, params: { techId: 't1' }, reasoning: 'r1' },
      { type: 'build', priority: 40, params: { planetId: 'p1' }, reasoning: 'r2' },
    ];

    const top = selectTopDecisions(decisions, 10);
    expect(top).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Empty galaxy edge cases
// ---------------------------------------------------------------------------

describe('AI in empty galaxy', () => {
  it('focuses on exploration when no known systems have colonizable planets', () => {
    const homeSystem = makeSystem({
      id: 'sys-home',
      ownerId: 'empire-1',
      wormholes: ['sys-unexplored'],
      planets: [makePlanet({ id: 'p-home', ownerId: 'empire-1' })],
    });
    const unexploredSystem = makeSystem({ id: 'sys-unexplored' });
    const galaxy = makeGalaxy([homeSystem, unexploredSystem]);
    const empire = makeEmpire({
      knownSystems: ['sys-home'], // sys-unexplored is unknown
    });
    const fleet = makeFleet({ position: { systemId: 'sys-home' } });
    const ship = makeShip();
    const gameState = makeGameState(galaxy, [empire], [fleet], [ship]);

    const eval_: AIEvaluation = {
      empireId: 'empire-1',
      militaryPower: 200,
      economicPower: 30,
      techLevel: 5,
      expansionPotential: 0,
      threatAssessment: new Map(),
    };

    const decisions = generateAIDecisions(empire, gameState, 'expansionist', eval_);
    const scouts = decisions.filter(d => d.params['purpose'] === 'scout');
    expect(scouts.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Multiple enemies
// ---------------------------------------------------------------------------

describe('AI with multiple enemies', () => {
  it('defensive AI seeks non-aggression with the strongest threat', () => {
    const empire = makeEmpire({
      aiPersonality: 'defensive',
      diplomacy: [
        { empireId: 'weak', status: 'neutral', treaties: [], attitude: -10, tradeRoutes: 0 },
        { empireId: 'strong', status: 'neutral', treaties: [], attitude: -20, tradeRoutes: 0 },
      ],
    });
    const eval_: AIEvaluation = {
      empireId: 'empire-1',
      militaryPower: 100,
      economicPower: 50,
      techLevel: 5,
      expansionPotential: 10,
      threatAssessment: new Map([['weak', 20], ['strong', 75]]),
    };

    const decisions = evaluateDiplomaticActions(empire, eval_, 'defensive');
    const strongNoAgg = decisions.find(
      d => d.params['targetEmpireId'] === 'strong' && d.params['treatyType'] === 'non_aggression',
    );
    expect(strongNoAgg).toBeDefined();
  });

  it('aggressive AI targets the weakest enemy when attacking', () => {
    const weakSystem = makeSystem({ id: 'sys-weak', ownerId: 'weak-enemy' });
    const strongSystem = makeSystem({ id: 'sys-strong', ownerId: 'strong-enemy' });
    const homeSystem = makeSystem({ id: 'sys-home', ownerId: 'empire-1' });
    const galaxy = makeGalaxy([homeSystem, weakSystem, strongSystem]);

    const empire = makeEmpire({
      aiPersonality: 'aggressive',
      knownSystems: ['sys-home', 'sys-weak', 'sys-strong'],
      diplomacy: [
        { empireId: 'weak-enemy', status: 'neutral', treaties: [], attitude: -30, tradeRoutes: 0 },
        { empireId: 'strong-enemy', status: 'neutral', treaties: [], attitude: -20, tradeRoutes: 0 },
      ],
    });
    const fleet = makeFleet({ empireId: 'empire-1', position: { systemId: 'sys-home' } });
    const ship = makeShip();

    const eval_: AIEvaluation = {
      empireId: 'empire-1',
      militaryPower: 1000,
      economicPower: 60,
      techLevel: 10,
      expansionPotential: 20,
      // weak enemy = low threat (low military), strong enemy = moderate
      threatAssessment: new Map([['weak-enemy', 25], ['strong-enemy', 45]]),
    };

    const decisions = evaluateMilitaryActions(empire, galaxy, [fleet], [ship], eval_);
    const warDecisions = decisions.filter(d => d.type === 'war');
    // Should target at least the weak enemy (attack ratio is very high against them)
    expect(warDecisions.some(d => d.params['targetEmpireId'] === 'weak-enemy')).toBe(true);
  });
});
