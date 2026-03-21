import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { StarSystem, Planet, BuildingType, Galaxy, ProductionItem } from '@nova-imperia/shared';
import type { EmpireResources } from '@nova-imperia/shared';
import { BUILDING_DEFINITIONS, UNIVERSAL_TECHNOLOGIES } from '@nova-imperia/shared';
import type { GameEngine } from '../engine/GameEngine';
import { getGameEngine } from '../engine/GameEngine';
import type { SpeciesCreatorContinueData } from './screens/SpeciesCreatorScreen';
import type { ResearchState } from '@nova-imperia/shared';
import type { Technology } from '@nova-imperia/shared';
import type { Fleet, Ship, ShipDesign } from '@nova-imperia/shared';
import type { Empire } from '@nova-imperia/shared';
import { useGameState } from './hooks/useGameState';
import { useGameEvent } from './hooks/useGameEvents';
import { TopBar } from './components/TopBar';
import { SystemInfoPanel } from './components/SystemInfoPanel';
import { PlanetDetailPanel } from './components/PlanetDetailPanel';
import { ColoniseNotification } from './components/ColoniseNotification';
import { Minimap } from './components/Minimap';
import { FleetPanel } from './components/FleetPanel';
import { SpeciesCreatorScreen } from './screens/SpeciesCreatorScreen';
import { GameSetupScreen } from './screens/GameSetupScreen';
import type { GameConfig } from './screens/GameSetupScreen';
import { PauseMenu } from './screens/PauseMenu';
import { PlanetManagementScreen } from './screens/PlanetManagementScreen';
import { ResearchScreen } from './screens/ResearchScreen';
import { ShipDesignerScreen } from './screens/ShipDesignerScreen';
import { DiplomacyScreen } from './screens/DiplomacyScreen';
import type { KnownEmpire } from './screens/DiplomacyScreen';

type AppScreen = 'game' | 'species-creator' | 'game-setup' | 'research' | 'ship-designer' | 'diplomacy';

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
    environmentPreference: { idealTemperature: 293, temperatureTolerance: 50, idealGravity: 1.0, gravityTolerance: 0.4, preferredAtmospheres: ['oxygen_nitrogen'] },
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
      species: { id: 'veth', name: 'Veth', description: 'Aquatic philosophers and traders.', portrait: 'veth', traits: { construction: 4, reproduction: 5, research: 8, espionage: 5, economy: 8, combat: 3, diplomacy: 9 }, environmentPreference: { idealTemperature: 285, temperatureTolerance: 40, idealGravity: 0.9, gravityTolerance: 0.5, preferredAtmospheres: ['oxygen_nitrogen'] }, specialAbilities: ['aquatic'], isPrebuilt: true },
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
  const [isPaused, setIsPaused] = useState(false);
  const [creatorData, setCreatorData] = useState<SpeciesCreatorContinueData | null>(null);
  const [managedPlanet, setManagedPlanet] = useState<Planet | null>(null);
  const [managedSystemId, setManagedSystemId] = useState<string | null>(null);
  const [empireResources, setEmpireResources] = useState<EmpireResources>(EMPTY_RESOURCES);
  const [buildNotification, setBuildNotification] = useState<string | null>(null);
  const [coloniseNotification, setColoniseNotification] = useState<string | null>(null);
  const [researchState, setResearchState] = useState<ResearchState>(MOCK_RESEARCH_STATE);
  const [allTechs, setAllTechs] = useState<Technology[]>(UNIVERSAL_TECHNOLOGIES);

  // ── Active system ID (set when SystemViewScene is active) ──
  // selectedSystem is only set on the galaxy map; activeSystemId covers the
  // system-view scene where selectedSystem is null.
  const [activeSystemId, setActiveSystemId] = useState<string | null>(null);

  // ── Galaxy state (for minimap) ──
  const [galaxy, setGalaxy] = useState<Galaxy | null>(null);

  // ── Viewport state (camera rect in galaxy coords, for minimap) ──
  const [viewport, setViewport] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // ── Live resource state (updated by engine ticks) ──
  const [liveCredits, setLiveCredits] = useState<number | undefined>(undefined);
  const [liveResearchPoints, setLiveResearchPoints] = useState<number | undefined>(undefined);

  // ── Ship Designer state ──
  const [savedDesigns, setSavedDesigns] = useState<ShipDesign[]>([]);

  // ── Diplomacy state ──
  const [playerEmpire, setPlayerEmpire] = useState<Empire>(MOCK_PLAYER_EMPIRE);
  const [knownEmpires] = useState<KnownEmpire[]>(MOCK_KNOWN_EMPIRES);

  // ── Fleet state ──
  const [selectedFleet, setSelectedFleet] = useState<Fleet | null>(null);
  const [fleetShips, setFleetShips] = useState<Ship[]>([]);

  // ── Known empire map (id → { name, color }) for PlanetDetailPanel ──
  const knownEmpireMap = useMemo((): Map<string, { name: string; color: string }> => {
    const map = new Map<string, { name: string; color: string }>();
    for (const ke of knownEmpires) {
      map.set(ke.empire.id, { name: ke.empire.name, color: ke.empire.color });
    }
    return map;
  }, [knownEmpires]);

  // ── Escape key: toggle pause menu during gameplay ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && currentScreen === 'game') {
        setIsPaused((prev) => !prev);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentScreen]);

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

  // Phaser emits this when an owned planet is clicked in SystemViewScene.
  // Payload is { planet, systemId } (see SystemViewScene.ts).
  const handleManagePlanet = useCallback(
    (payload: { planet: Planet; systemId: string }) => {
      setManagedPlanet(payload.planet);
      setManagedSystemId(payload.systemId);
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
    setIsPaused(false);
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

  // SystemViewScene emits 'system:entered' so we know which system is active
  // even when the galaxy-map selectedSystem is null.
  const handleSystemEntered = useCallback((payload: { systemId: string }) => {
    setActiveSystemId(payload.systemId);
  }, []);

  const handleSystemExited = useCallback(() => {
    setActiveSystemId(null);
  }, []);

  // Engine emits 'engine:galaxy_updated' with the Galaxy object each tick
  const handleGalaxyUpdated = useCallback((g: Galaxy) => {
    setGalaxy(g);
  }, []);

  // Engine emits 'engine:planet_colonised' after a colonisation action succeeds
  const handlePlanetColonised = useCallback(
    (payload: { planetName: string; systemId: string; planetId: string }) => {
      setColoniseNotification(payload.planetName);
    },
    [],
  );

  // Engine emits 'engine:planet_updated' after buildOnPlanet / cancelConstruction
  // and at the end of each tick when a construction queue item completes.
  const handlePlanetUpdated = useCallback(
    (payload: { systemId: string; planet: Planet }) => {
      // If this planet is the one currently open in the management screen, refresh it.
      setManagedPlanet((prev) => {
        if (prev && prev.id === payload.planet.id) {
          return payload.planet;
        }
        return prev;
      });
    },
    [],
  );

  // Detect building completion by watching queue length transitions via engine:tick
  // We track the previous queue state to detect when an item completes.
  // Also keeps playerEmpire in sync with the engine's authoritative state.
  const handleEngineTick = useCallback(() => {
    // Sync player empire from engine state so credits/species are always accurate
    const engine: GameEngine | undefined = getGameEngine();
    if (engine) {
      const playerEmp = engine.getState().gameState.empires.find(e => !e.isAI);
      if (playerEmp) setPlayerEmpire(playerEmp);
    }

    setManagedPlanet((prev) => {
      if (!prev || !managedSystemId) return prev;
      // Fetch the latest planet state from the engine
      const eng: GameEngine | undefined = getGameEngine();
      if (!eng) return prev;
      const state = eng.getState();
      const system = state.gameState.galaxy.systems.find(s => s.id === managedSystemId);
      if (!system) return prev;
      const latestPlanet = system.planets.find(p => p.id === prev.id);
      if (!latestPlanet) return prev;

      // Detect if the front-of-queue item just completed (queue shrank + new building appeared)
      if (prev.productionQueue.length > 0 && latestPlanet.productionQueue.length < prev.productionQueue.length) {
        const completedItem = prev.productionQueue[0] as ProductionItem | undefined;
        if (completedItem?.type === 'building') {
          const def = BUILDING_DEFINITIONS[completedItem.templateId as import('@nova-imperia/shared').BuildingType];
          if (def) {
            setBuildNotification(`Construction complete: ${def.name} on ${latestPlanet.name}`);
            // Auto-dismiss after 4 seconds
            setTimeout(() => setBuildNotification(null), 4000);
          }
        }
      }

      return latestPlanet;
    });
  }, [managedSystemId]);

  // Engine emits 'engine:viewport_changed' each frame from GalaxyMapScene
  const handleViewportChanged = useCallback(
    (vp: { x: number; y: number; width: number; height: number }) => {
      setViewport(vp);
    },
    [],
  );

  // Engine emits 'engine:resources_updated' each tick with per-empire resource snapshots
  const handleEngineResourcesUpdated = useCallback(
    (updates: Array<{ empireId: string; credits: number; researchPoints: number }>) => {
      // Apply the first non-AI empire's resources to the TopBar display.
      // We identify the player empire by looking for the entry we already know
      // about via MOCK_PLAYER_EMPIRE ('player') OR by taking the first entry
      // (the player is always first in initializeGame's output).
      if (updates.length > 0) {
        const playerEntry = updates[0]!;
        setLiveCredits(playerEntry.credits);
        setLiveResearchPoints(playerEntry.researchPoints);
      }
    },
    [],
  );

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
  useGameEvent<{ systemId: string }>('system:entered', handleSystemEntered);
  useGameEvent<void>('system:exited', handleSystemExited);
  useGameEvent<string>('scene:change', handleSceneChange);
  useGameEvent<void>('ui:new_game', handleNewGame);
  useGameEvent<void>('ui:research', handleOpenResearch);
  useGameEvent<void>('ui:ship_designer', handleOpenShipDesigner);
  useGameEvent<void>('ui:diplomacy', handleOpenDiplomacy);
  useGameEvent<Empire>('empire:updated', handleEmpireUpdate);
  useGameEvent<{ planet: Planet; systemId: string }>('planet:manage', handleManagePlanet);
  useGameEvent<EmpireResources>('empire:resources_updated', handleResourcesUpdate);
  useGameEvent<ResearchState>('research:state_updated', handleResearchStateUpdate);
  useGameEvent<Technology[]>('research:techs_loaded', handleTechsLoaded);
  useGameEvent<{ fleet: Fleet; ships: Ship[] }>('fleet:selected', handleFleetSelected);
  useGameEvent<void>('fleet:deselected', handleFleetDeselected);
  // Engine events
  useGameEvent<Galaxy>('engine:galaxy_updated', handleGalaxyUpdated);
  useGameEvent<{ x: number; y: number; width: number; height: number }>('engine:viewport_changed', handleViewportChanged);
  useGameEvent<Array<{ empireId: string; credits: number; researchPoints: number }>>('engine:resources_updated', handleEngineResourcesUpdated);
  useGameEvent<{ systemId: string; planet: Planet }>('engine:planet_updated', handlePlanetUpdated);
  useGameEvent<{ tick: number }>('engine:tick', handleEngineTick);
  useGameEvent<{ planetName: string; systemId: string; planetId: string }>('engine:planet_colonised', handlePlanetColonised);

  const handleClosePlanet = useCallback(() => {
    setSelectedPlanet(null);
  }, [setSelectedPlanet]);

  const handleCloseManagedPlanet = useCallback(() => {
    setManagedPlanet(null);
    setManagedSystemId(null);
  }, []);

  const handleBuild = useCallback(
    (planetId: string, buildingType: BuildingType) => {
      if (!managedSystemId) {
        console.warn('[App.handleBuild] No system ID for managed planet');
        return;
      }
      const engine: GameEngine | undefined = getGameEngine();
      if (!engine) {
        console.warn('[App.handleBuild] GameEngine not available');
        return;
      }
      const success = engine.buildOnPlanet(managedSystemId, planetId, buildingType);
      if (!success) {
        console.warn(`[App.handleBuild] buildOnPlanet returned false for ${buildingType}`);
      }
    },
    [managedSystemId],
  );

  const handleCancelQueue = useCallback(
    (planetId: string, queueIndex: number) => {
      if (!managedSystemId) {
        console.warn('[App.handleCancelQueue] No system ID for managed planet');
        return;
      }
      const engine: GameEngine | undefined = getGameEngine();
      if (!engine) {
        console.warn('[App.handleCancelQueue] GameEngine not available');
        return;
      }
      engine.cancelConstruction(managedSystemId, planetId, queueIndex);
    },
    [managedSystemId],
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
    const game = (window as unknown as Record<string, unknown>).__EX_NIHILO_GAME__ as
      | { events: { emit: (e: string, d: unknown) => void } }
      | undefined;
    game?.events.emit('research:start', { techId, allocation });
  }, []);

  const handleCancelResearch = useCallback((techId: string) => {
    setResearchState((prev) => ({
      ...prev,
      activeResearch: prev.activeResearch.filter((r) => r.techId !== techId),
    }));
    const game = (window as unknown as Record<string, unknown>).__EX_NIHILO_GAME__ as
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
    const game = (window as unknown as Record<string, unknown>).__EX_NIHILO_GAME__ as
      | { events: { emit: (e: string, d: unknown) => void } }
      | undefined;
    game?.events.emit('research:allocate', { techId, allocation });
  }, []);

  // Species creator → game setup
  const handleSpeciesCreatorContinue = useCallback((data: SpeciesCreatorContinueData) => {
    setCreatorData(data);
    setCurrentScreen('game-setup');
  }, []);

  // Game setup → back to species creator
  const handleBackFromSetup = useCallback(() => {
    setCurrentScreen('species-creator');
  }, []);

  // Game setup → start game (GameSetupScreen already emitted 'game:start_with_config')
  const handleStartGame = useCallback((_config: GameConfig) => {
    setCurrentScreen('game');
    setIsPaused(false);
  }, []);

  // Pause menu
  const handleResume = useCallback(() => {
    setIsPaused(false);
  }, []);

  const handleExitToMainMenu = useCallback(() => {
    setIsPaused(false);
    setCurrentScreen('game');
    // Tell Phaser to go back to the main menu scene
    const game = (window as unknown as Record<string, unknown>).__EX_NIHILO_GAME__ as
      | { scene: { start: (key: string) => void }; events: { emit: (e: string) => void } }
      | undefined;
    if (game) {
      // Stop all scenes and restart main menu
      game.events.emit('ui:exit_to_menu');
    }
  }, []);

  // Render species creator as full-screen overlay
  if (currentScreen === 'species-creator') {
    return (
      <div className="ui-overlay">
        <SpeciesCreatorScreen
          onBack={handleBackFromCreator}
          onContinue={handleSpeciesCreatorContinue}
        />
      </div>
    );
  }

  // Render game setup as full-screen overlay
  if (currentScreen === 'game-setup' && creatorData) {
    return (
      <div className="ui-overlay">
        <GameSetupScreen
          species={creatorData.species}
          originStory={creatorData.originStory}
          governmentType={creatorData.governmentType}
          onBack={handleBackFromSetup}
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
        credits={liveCredits}
        researchPoints={liveResearchPoints}
        onOpenResearch={handleOpenResearch}
        onOpenShipDesigner={handleOpenShipDesigner}
        onOpenDiplomacy={handleOpenDiplomacy}
      />

      <SystemInfoPanel system={selectedSystem} />

      <PlanetDetailPanel
        planet={selectedPlanet}
        onClose={handleClosePlanet}
        playerEmpire={playerEmpire}
        knownEmpireMap={knownEmpireMap}
        systemId={activeSystemId ?? selectedSystem?.id ?? null}
      />

      <Minimap
        systems={galaxy?.systems ?? []}
        galaxyWidth={galaxy?.width ?? 1000}
        galaxyHeight={galaxy?.height ?? 1000}
        viewport={viewport}
      />

      {managedPlanet && managedSystemId && (
        <PlanetManagementScreen
          planet={managedPlanet}
          systemId={managedSystemId}
          empireResources={empireResources}
          onClose={handleCloseManagedPlanet}
          onBuild={handleBuild}
          onCancelQueue={handleCancelQueue}
        />
      )}

      {buildNotification && (
        <div className="build-notification" role="status" aria-live="polite">
          {buildNotification}
        </div>
      )}

      {coloniseNotification && (
        <ColoniseNotification
          planetName={coloniseNotification}
          onDismiss={() => setColoniseNotification(null)}
        />
      )}

      {selectedFleet && (
        <FleetPanel
          fleet={selectedFleet}
          ships={fleetShips}
          onClose={handleFleetDeselected}
        />
      )}

      {isPaused && (
        <PauseMenu
          onResume={handleResume}
          onExitToMainMenu={handleExitToMainMenu}
        />
      )}
    </div>
  );
}
