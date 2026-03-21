import React, { useCallback, useState } from 'react';
import type { StarSystem, Planet, BuildingType } from '@nova-imperia/shared';
import type { Species, EmpireResources } from '@nova-imperia/shared';
import type { ResearchState } from '@nova-imperia/shared';
import type { Technology } from '@nova-imperia/shared';
import { useGameState } from './hooks/useGameState';
import { useGameEvent } from './hooks/useGameEvents';
import { TopBar } from './components/TopBar';
import { SystemInfoPanel } from './components/SystemInfoPanel';
import { PlanetDetailPanel } from './components/PlanetDetailPanel';
import { Minimap } from './components/Minimap';
import { SpeciesCreatorScreen } from './screens/SpeciesCreatorScreen';
import { PlanetManagementScreen } from './screens/PlanetManagementScreen';
import { ResearchScreen } from './screens/ResearchScreen';

type AppScreen = 'game' | 'species-creator' | 'research';

/** Mock tech data for initial research screen display before real game data is wired up. */
const MOCK_ALL_TECHS: Technology[] = [];

/** Mock research state: a few Dawn Age techs completed, nothing active. */
const MOCK_RESEARCH_STATE: ResearchState = {
  completedTechs: ['pulse_lasers', 'composite_armor', 'ion_drives', 'growth_stimulants'],
  activeResearch: [],
  currentAge: 'diamond_age',
  totalResearchGenerated: 0,
};

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

  useGameEvent<StarSystem>('system:selected', handleSystemSelected);
  useGameEvent<Planet>('planet:selected', handlePlanetSelected);
  useGameEvent<void>('system:deselected', handleSystemDeselected);
  useGameEvent<void>('planet:deselected', handlePlanetDeselected);
  useGameEvent<string>('scene:change', handleSceneChange);
  useGameEvent<void>('ui:new_game', handleNewGame);
  useGameEvent<void>('ui:research', handleOpenResearch);
  useGameEvent<Planet>('planet:manage', handleManagePlanet);
  useGameEvent<EmpireResources>('empire:resources_updated', handleResourcesUpdate);
  useGameEvent<ResearchState>('research:state_updated', handleResearchStateUpdate);
  useGameEvent<Technology[]>('research:techs_loaded', handleTechsLoaded);

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
    </div>
  );
}
