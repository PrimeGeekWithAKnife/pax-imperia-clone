import React, { useCallback, useState } from 'react';
import type { StarSystem, Planet, BuildingType } from '@nova-imperia/shared';
import type { Species, EmpireResources } from '@nova-imperia/shared';
import type { ResearchState } from '@nova-imperia/shared';
import type { Technology } from '@nova-imperia/shared';
import type { Fleet, Ship, ShipDesign } from '@nova-imperia/shared';
import type { Empire } from '@nova-imperia/shared';
import { useGameState } from './hooks/useGameState';
import { useGameEvent } from './hooks/useGameEvents';
import { TopBar } from './components/TopBar';
import { SystemInfoPanel } from './components/SystemInfoPanel';
import { PlanetDetailPanel } from './components/PlanetDetailPanel';
import { Minimap } from './components/Minimap';
import { FleetPanel } from './components/FleetPanel';
import { SpeciesCreatorScreen } from './screens/SpeciesCreatorScreen';
import { PlanetManagementScreen } from './screens/PlanetManagementScreen';
import { ResearchScreen } from './screens/ResearchScreen';
import { ShipDesignerScreen } from './screens/ShipDesignerScreen';
import { DiplomacyScreen } from './screens/DiplomacyScreen';
import type { KnownEmpire } from './screens/DiplomacyScreen';

type AppScreen = 'game' | 'species-creator' | 'research' | 'ship-designer' | 'diplomacy';

/** Mock tech data for initial research screen display before real game data is wired up. */
const MOCK_ALL_TECHS: Technology[] = [];

/** Mock research state: a few Dawn Age techs completed, nothing active. */
const MOCK_RESEARCH_STATE: ResearchState = {
  completedTechs: ['pulse_lasers', 'composite_armor', 'ion_drives', 'growth_stimulants'],
  activeResearch: [],
  currentAge: 'diamond_age',
  totalResearchGenerated: 0,
};

/** Mock player empire for the diplomacy screen before real data is wired up. */
const MOCK_PLAYER_EMPIRE: Empire = {
  id: 'player',
  name: 'Terran Federation',
  species: {
    id: 'human',
    name: 'Human',
    description: 'Adaptable and resourceful.',
    portrait: 'human',
    traits: { construction: 5, reproduction: 5, research: 6, espionage: 5, economy: 6, combat: 5, diplomacy: 7 },
    environmentPreference: { idealTemperature: 293, temperatureTolerance: 50, idealGravity: 1.0, gravityTolerance: 0.4, preferredAtmospheres: ['oxygen'] },
    specialAbilities: [],
    isPrebuilt: true,
  },
  color: '#00d4ff',
  credits: 2500,
  researchPoints: 0,
  knownSystems: [],
  diplomacy: [],
  technologies: [],
  currentAge: 'diamond_age',
  isAI: false,
};

/** Mock known empires for the diplomacy screen before real data is wired up. */
const MOCK_KNOWN_EMPIRES: KnownEmpire[] = [
  {
    empire: {
      id: 'nk_hegemony',
      name: 'Nk\'thari Hegemony',
      species: { id: 'nkthari', name: 'Nk\'thari', description: 'Insectoid hive-mind collective.', portrait: 'nkthari', traits: { construction: 8, reproduction: 9, research: 5, espionage: 6, economy: 4, combat: 7, diplomacy: 3 }, environmentPreference: { idealTemperature: 310, temperatureTolerance: 30, idealGravity: 1.2, gravityTolerance: 0.3, preferredAtmospheres: ['nitrogen'] }, specialAbilities: ['hive_mind'], isPrebuilt: true },
      color: '#ff6d00',
      credits: 1800,
      researchPoints: 0,
      knownSystems: [],
      diplomacy: [],
      technologies: [],
      currentAge: 'diamond_age',
      isAI: true,
      aiPersonality: 'aggressive',
    },
    relation: { empireId: 'player', status: 'hostile', treaties: [], attitude: -45, tradeRoutes: 0 },
    trust: 12,
    incidents: [
      { turn: 3, description: 'Nk\'thari fleet violated border near Proxima.', kind: 'negative' },
      { turn: 1, description: 'First contact established.', kind: 'neutral' },
    ],
    isKnown: true,
  },
  {
    empire: {
      id: 'veth_republic',
      name: 'Veth Republic',
      species: { id: 'veth', name: 'Veth', description: 'Aquatic philosophers and traders.', portrait: 'veth', traits: { construction: 4, reproduction: 5, research: 8, espionage: 5, economy: 8, combat: 3, diplomacy: 9 }, environmentPreference: { idealTemperature: 285, temperatureTolerance: 40, idealGravity: 0.9, gravityTolerance: 0.5, preferredAtmospheres: ['oxygen'] }, specialAbilities: ['aquatic'], isPrebuilt: true },
      color: '#00e676',
      credits: 3100,
      researchPoints: 0,
      knownSystems: [],
      diplomacy: [],
      technologies: [],
      currentAge: 'diamond_age',
      isAI: true,
      aiPersonality: 'diplomatic',
    },
    relation: { empireId: 'player', status: 'friendly', treaties: [{ type: 'non_aggression', startTurn: 1, duration: -1 }, { type: 'trade', startTurn: 2, duration: 20 }], attitude: 52, tradeRoutes: 2 },
    trust: 68,
    incidents: [
      { turn: 4, description: 'Veth Republic shared navigation charts for Kepler sector.', kind: 'positive' },
      { turn: 2, description: 'Trade agreement signed for mutual benefit.', kind: 'positive' },
      { turn: 1, description: 'First contact — peaceful greeting exchanged.', kind: 'neutral' },
    ],
    isKnown: true,
  },
  {
    empire: {
      id: 'unknown_01',
      name: 'Unknown Empire',
      species: { id: 'unknown', name: 'Unknown Species', description: '', portrait: '', traits: { construction: 5, reproduction: 5, research: 5, espionage: 5, economy: 5, combat: 5, diplomacy: 5 }, environmentPreference: { idealTemperature: 293, temperatureTolerance: 50, idealGravity: 1.0, gravityTolerance: 0.5, preferredAtmospheres: [] }, specialAbilities: [], isPrebuilt: false },
      color: '#607d8b',
      credits: 0,
      researchPoints: 0,
      knownSystems: [],
      diplomacy: [],
      technologies: [],
      currentAge: 'diamond_age',
      isAI: true,
    },
    relation: { empireId: 'player', status: 'unknown', treaties: [], attitude: 0, tradeRoutes: 0 },
    trust: 0,
    incidents: [],
    isKnown: false,
  },
];

/** Minimal stub resources for the management screen when empire data isn't available. */
const EMPTY_RESOURCES: EmpireResources = {
  credits: 0,
  minerals: 0,
  rareElements: 0,
  energy: 0,
  organics: 0,
  exoticMaterials: 0,
  faith: 0,
  researchPoints: 0,
};

/**
 * App is the React root rendered on top of the Phaser canvas.
 *
 * The outer div uses pointer-events: none so mouse events pass through to
 * Phaser by default. Interactive children set pointer-events: auto via CSS.
 */
export function App(): React.ReactElement {
  const {
    selectedSystem,
    selectedPlanet,
    gameSpeed,
    setSelectedSystem,
    setSelectedPlanet,
    setGameSpeed,
    setCurrentScene,
  } = useGameState();

  const [currentScreen, setCurrentScreen] = useState<AppScreen>('game');
  const [managedPlanet, setManagedPlanet] = useState<Planet | null>(null);
  const [empireResources, setEmpireResources] = useState<EmpireResources>(EMPTY_RESOURCES);
  const [researchState, setResearchState] = useState<ResearchState>(MOCK_RESEARCH_STATE);
  const [allTechs, setAllTechs] = useState<Technology[]>(MOCK_ALL_TECHS);

  // ── Ship Designer state ──
  const [savedDesigns, setSavedDesigns] = useState<ShipDesign[]>([]);

  // ── Diplomacy state ──
  const [playerEmpire, setPlayerEmpire] = useState<Empire>(MOCK_PLAYER_EMPIRE);
  const [knownEmpires] = useState<KnownEmpire[]>(MOCK_KNOWN_EMPIRES);

  // ── Fleet state ──
  const [selectedFleet, setSelectedFleet] = useState<Fleet | null>(null);
  const [fleetShips, setFleetShips] = useState<Ship[]>([]);

  // ── Phaser → React event bridges ──

  const handleSystemSelected = useCallback(
    (system: StarSystem) => {
      setSelectedSystem(system);
    },
    [setSelectedSystem],
  );

  const handlePlanetSelected = useCallback(
    (planet: Planet) => {
      setSelectedPlanet(planet);
    },
    [setSelectedPlanet],
  );

  const handleSystemDeselected = useCallback(() => {
    setSelectedSystem(null);
  }, [setSelectedSystem]);

  const handlePlanetDeselected = useCallback(() => {
    setSelectedPlanet(null);
  }, [setSelectedPlanet]);

  const handleSceneChange = useCallback(
    (sceneName: string) => {
      setCurrentScene(sceneName);
    },
    [setCurrentScene],
  );

  // Phaser emits this when "Manage" is clicked on a colonized planet
  const handleManagePlanet = useCallback(
    (planet: Planet) => {
      setManagedPlanet(planet);
    },
    [],
  );

  // Phaser emits empire resource updates so the build picker knows affordability
  const handleResourcesUpdate = useCallback(
    (resources: EmpireResources) => {
      setEmpireResources(resources);
    },
    [],
  );

  // Phaser emits this when "New Game" is clicked
  const handleNewGame = useCallback(() => {
    setCurrentScreen('species-creator');
  }, []);

  // Phaser emits this to open the research screen
  const handleOpenResearch = useCallback(() => {
    setCurrentScreen('research');
  }, []);

  // Phaser can push a full research state update (e.g. after a tick resolves)
  const handleResearchStateUpdate = useCallback(
    (state: ResearchState) => {
      setResearchState(state);
    },
    [],
  );

  // Phaser can push the full tech list once the game is initialised
  const handleTechsLoaded = useCallback(
    (techs: Technology[]) => {
      setAllTechs(techs);
    },
    [],
  );

  // Phaser emits this to open the ship designer
  const handleOpenShipDesigner = useCallback(() => {
    setCurrentScreen('ship-designer');
  }, []);

  const handleCloseShipDesigner = useCallback(() => {
    setCurrentScreen('game');
  }, []);

  // Phaser emits this to open the diplomacy screen
  const handleOpenDiplomacy = useCallback(() => {
    setCurrentScreen('diplomacy');
  }, []);

  const handleCloseDiplomacy = useCallback(() => {
    setCurrentScreen('game');
  }, []);

  // Phaser can push updated empire data (player + known empires)
  const handleEmpireUpdate = useCallback((empire: Empire) => {
    setPlayerEmpire(empire);
  }, []);

  const handleSaveDesign = useCallback((design: ShipDesign) => {
    setSavedDesigns((prev) => {
      const withoutOld = prev.filter((d) => d.id !== design.id);
      return [...withoutOld, design];
    });
  }, []);

  // Phaser emits when a fleet is clicked on the galaxy map
  const handleFleetSelected = useCallback(
    (data: { fleet: Fleet; ships: Ship[] }) => {
      setSelectedFleet(data.fleet);
      setFleetShips(data.ships);
    },
    [],
  );

  const handleFleetDeselected = useCallback(() => {
    setSelectedFleet(null);
    setFleetShips([]);
  }, []);

  useGameEvent<StarSystem>('system:selected', handleSystemSelected);
  useGameEvent<Planet>('planet:selected', handlePlanetSelected);
  useGameEvent<void>('system:deselected', handleSystemDeselected);
  useGameEvent<void>('planet:deselected', handlePlanetDeselected);
  useGameEvent<string>('scene:change', handleSceneChange);
  useGameEvent<void>('ui:new_game', handleNewGame);
  useGameEvent<void>('ui:research', handleOpenResearch);
  useGameEvent<void>('ui:ship_designer', handleOpenShipDesigner);
  useGameEvent<void>('ui:diplomacy', handleOpenDiplomacy);
  useGameEvent<Empire>('empire:updated', handleEmpireUpdate);
  useGameEvent<Planet>('planet:manage', handleManagePlanet);
  useGameEvent<EmpireResources>('empire:resources_updated', handleResourcesUpdate);
  useGameEvent<ResearchState>('research:state_updated', handleResearchStateUpdate);
  useGameEvent<Technology[]>('research:techs_loaded', handleTechsLoaded);
  useGameEvent<{ fleet: Fleet; ships: Ship[] }>('fleet:selected', handleFleetSelected);
  useGameEvent<void>('fleet:deselected', handleFleetDeselected);

  const handleClosePlanet = useCallback(() => {
    setSelectedPlanet(null);
  }, [setSelectedPlanet]);

  const handleCloseManagedPlanet = useCallback(() => {
    setManagedPlanet(null);
  }, []);

  const handleBuild = useCallback(
    (planetId: string, buildingType: BuildingType) => {
      const game = (window as unknown as Record<string, unknown>).__NOVA_GAME__ as
        | { events: { emit: (e: string, d: unknown) => void } }
        | undefined;
      game?.events.emit('planet:build', { planetId, buildingType });
    },
    [],
  );

  const handleCancelQueue = useCallback(
    (planetId: string, queueIndex: number) => {
      const game = (window as unknown as Record<string, unknown>).__NOVA_GAME__ as
        | { events: { emit: (e: string, d: unknown) => void } }
        | undefined;
      game?.events.emit('planet:cancel_queue', { planetId, queueIndex });
    },
    [],
  );

  const handleBackFromCreator = useCallback(() => {
    setCurrentScreen('game');
  }, []);

  const handleCloseResearch = useCallback(() => {
    setCurrentScreen('game');
  }, []);

  const handleStartResearch = useCallback((techId: string, allocation: number) => {
    setResearchState((prev) => {
      const currentTotal = prev.activeResearch.reduce((sum, r) => sum + r.allocation, 0);
      if (currentTotal + allocation > 100) return prev;
      if (prev.completedTechs.includes(techId)) return prev;
      if (prev.activeResearch.some((r) => r.techId === techId)) return prev;
      return {
        ...prev,
        activeResearch: [
          ...prev.activeResearch,
          { techId, pointsInvested: 0, allocation },
        ],
      };
    });
    // Also notify Phaser
    const game = (window as unknown as Record<string, unknown>).__NOVA_GAME__ as
      | { events: { emit: (e: string, d: unknown) => void } }
      | undefined;
    game?.events.emit('research:start', { techId, allocation });
  }, []);

  const handleCancelResearch = useCallback((techId: string) => {
    setResearchState((prev) => ({
      ...prev,
      activeResearch: prev.activeResearch.filter((r) => r.techId !== techId),
    }));
    const game = (window as unknown as Record<string, unknown>).__NOVA_GAME__ as
      | { events: { emit: (e: string, d: unknown) => void } }
      | undefined;
    game?.events.emit('research:cancel', { techId });
  }, []);

  const handleAdjustAllocation = useCallback((techId: string, allocation: number) => {
    setResearchState((prev) => {
      const otherTotal = prev.activeResearch
        .filter((r) => r.techId !== techId)
        .reduce((sum, r) => sum + r.allocation, 0);
      if (otherTotal + allocation > 100) return prev;
      return {
        ...prev,
        activeResearch: prev.activeResearch.map((r) =>
          r.techId === techId ? { ...r, allocation } : r,
        ),
      };
    });
    const game = (window as unknown as Record<string, unknown>).__NOVA_GAME__ as
      | { events: { emit: (e: string, d: unknown) => void } }
      | undefined;
    game?.events.emit('research:allocate', { techId, allocation });
  }, []);

  const handleStartGame = useCallback((_species: Species) => {
    // Species was already emitted to Phaser via 'game:start' event inside SpeciesCreatorScreen
    setCurrentScreen('game');
  }, []);

  // Render species creator as full-screen overlay
  if (currentScreen === 'species-creator') {
    return (
      <div className="ui-overlay">
        <SpeciesCreatorScreen
          onBack={handleBackFromCreator}
          onStartGame={handleStartGame}
        />
      </div>
    );
  }

  // Render research screen as full-screen overlay
  if (currentScreen === 'research') {
    return (
      <div className="ui-overlay">
        <ResearchScreen
          allTechs={allTechs}
          researchState={researchState}
          researchPerTick={empireResources.researchPoints > 0 ? empireResources.researchPoints : 10}
          speciesBonus={1}
          onStartResearch={handleStartResearch}
          onCancelResearch={handleCancelResearch}
          onAdjustAllocation={handleAdjustAllocation}
          onClose={handleCloseResearch}
        />
      </div>
    );
  }

  // Render ship designer as full-screen overlay
  if (currentScreen === 'ship-designer') {
    return (
      <div className="ui-overlay">
        <ShipDesignerScreen
          researchedTechs={researchState.completedTechs}
          empireId="player"
          savedDesigns={savedDesigns}
          onSaveDesign={handleSaveDesign}
          onClose={handleCloseShipDesigner}
        />
      </div>
    );
  }

  // Render diplomacy screen as full-screen overlay
  if (currentScreen === 'diplomacy') {
    return (
      <div className="ui-overlay">
        <DiplomacyScreen
          playerEmpire={playerEmpire}
          knownEmpires={knownEmpires}
          currentTurn={1}
          onClose={handleCloseDiplomacy}
        />
      </div>
    );
  }

  return (
    <div className="ui-overlay">
      <TopBar
        gameSpeed={gameSpeed}
        onSpeedChange={setGameSpeed}
      />

      <SystemInfoPanel system={selectedSystem} />

      <PlanetDetailPanel
        planet={selectedPlanet}
        onClose={handleClosePlanet}
      />

      <Minimap
        systems={selectedSystem ? [] : []}
        galaxyWidth={1000}
        galaxyHeight={1000}
      />

      {managedPlanet && (
        <PlanetManagementScreen
          planet={managedPlanet}
          empireResources={empireResources}
          onClose={handleCloseManagedPlanet}
          onBuild={handleBuild}
          onCancelQueue={handleCancelQueue}
        />
      )}

      {selectedFleet && (
        <FleetPanel
          fleet={selectedFleet}
          ships={fleetShips}
          onClose={handleFleetDeselected}
        />
      )}
    </div>
  );
}
