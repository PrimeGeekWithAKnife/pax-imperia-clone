import React, { useCallback, useState } from 'react';
import type { StarSystem, Planet, BuildingType } from '@nova-imperia/shared';
import type { Species, EmpireResources } from '@nova-imperia/shared';
import { useGameState } from './hooks/useGameState';
import { useGameEvent } from './hooks/useGameEvents';
import { TopBar } from './components/TopBar';
import { SystemInfoPanel } from './components/SystemInfoPanel';
import { PlanetDetailPanel } from './components/PlanetDetailPanel';
import { Minimap } from './components/Minimap';
import { SpeciesCreatorScreen } from './screens/SpeciesCreatorScreen';
import { PlanetManagementScreen } from './screens/PlanetManagementScreen';

type AppScreen = 'game' | 'species-creator';

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

  useGameEvent<StarSystem>('system:selected', handleSystemSelected);
  useGameEvent<Planet>('planet:selected', handlePlanetSelected);
  useGameEvent<void>('system:deselected', handleSystemDeselected);
  useGameEvent<void>('planet:deselected', handlePlanetDeselected);
  useGameEvent<string>('scene:change', handleSceneChange);
  useGameEvent<void>('ui:new_game', handleNewGame);
  useGameEvent<Planet>('planet:manage', handleManagePlanet);
  useGameEvent<EmpireResources>('empire:resources_updated', handleResourcesUpdate);

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
