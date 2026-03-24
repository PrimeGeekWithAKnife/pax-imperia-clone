import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StarSystem, Planet, BuildingType, Galaxy, ProductionItem } from '@nova-imperia/shared';
import type { EmpireResources } from '@nova-imperia/shared';
import { BUILDING_DEFINITIONS, UNIVERSAL_TECHNOLOGIES } from '@nova-imperia/shared';
import type { GameEngine } from '../engine/GameEngine';
import { getGameEngine } from '../engine/GameEngine';
import type { MigrationOrder } from '../engine/migration';
import { estimateTotalWaves } from '../engine/migration';
import type { SpeciesCreatorContinueData } from './screens/SpeciesCreatorScreen';
import type { ResearchState } from '@nova-imperia/shared';
import type { Technology } from '@nova-imperia/shared';
import type { Fleet, Ship, ShipDesign } from '@nova-imperia/shared';
import type { Empire } from '@nova-imperia/shared';
import type { GameNotification, NotificationPreferences, NotificationType } from '@nova-imperia/shared';
import { shouldShowNotification } from '@nova-imperia/shared';
import { useGameState } from './hooks/useGameState';
import { useGameEvent } from './hooks/useGameEvents';
import { getAudioEngine, SfxGenerator } from '../audio';
import { TopBar } from './components/TopBar';
import { SystemInfoPanel } from './components/SystemInfoPanel';
import { PlanetDetailPanel } from './components/PlanetDetailPanel';
import type { ActiveMigrationInfo } from './components/PlanetDetailPanel';
import { ColoniseNotification } from './components/ColoniseNotification';
import { Minimap } from './components/Minimap';
import { FleetPanel } from './components/FleetPanel';
import { SpeciesCreatorScreen } from './screens/SpeciesCreatorScreen';
import { GameSetupScreen } from './screens/GameSetupScreen';
import type { GameConfig } from './screens/GameSetupScreen';
import { PauseMenu } from './screens/PauseMenu';
import { SaveLoadScreen } from './screens/SaveLoadScreen';
import type { SaveLoadTab } from './screens/SaveLoadScreen';
import { PlanetManagementScreen } from './screens/PlanetManagementScreen';
import { ResearchScreen } from './screens/ResearchScreen';
import { ShipDesignerScreen } from './screens/ShipDesignerScreen';
import { DiplomacyScreen } from './screens/DiplomacyScreen';
import type { KnownEmpire } from './screens/DiplomacyScreen';
import { FleetScreen } from './screens/FleetScreen';
import { BattleResultsScreen } from './screens/BattleResultsScreen';
import type { BattleResultsData } from './screens/BattleResultsScreen';
import { EspionageScreen } from './screens/EspionageScreen';
import type { EspionageState, EspionageEvent, SpyAgent, SpyMission } from '@nova-imperia/shared';
import { initialiseEspionage, addAgentToState, assignMission } from '@nova-imperia/shared';
import { EconomyScreen } from './screens/EconomyScreen';
import { VictoryScreen } from './screens/VictoryScreen';
import type { GameStatistics } from './screens/VictoryScreen';
import { MultiplayerLobbyScreen } from './screens/MultiplayerLobbyScreen';
import type { LobbyGalaxyConfig } from '../network/GameClient';
import { Tooltip } from './components/Tooltip';
import { EventLog, createLogEntry } from './components/EventLog';
import { NotificationPopup } from './components/NotificationPopup';
import type { GameLogEntry } from './components/EventLog';
import { VictoryTracker } from './components/VictoryTracker';
import { calculateVictoryProgress } from '@nova-imperia/shared';
import type { VictoryProgress } from '@nova-imperia/shared';

type AppScreen = 'game' | 'species-creator' | 'game-setup' | 'multiplayer' | 'research' | 'ship-designer' | 'diplomacy' | 'fleet' | 'espionage' | 'economy' | 'victory';

/** Mock research state: a few Dawn Age techs completed, nothing active. */
const MOCK_RESEARCH_STATE: ResearchState = {
  completedTechs: [],
  activeResearch: [],
  currentAge: 'nano_atomic',
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
  currentAge: 'nano_atomic',
  isAI: false,
  government: 'democracy',
};

/**
 * Build a KnownEmpire list from live engine state.
 *
 * Looks up the player empire's diplomacy relations and maps each AI empire
 * to a KnownEmpire entry. Empires without a relation entry are treated as
 * unknown.
 */
function buildKnownEmpiresFromEngine(engine: GameEngine): KnownEmpire[] {
  const state = engine.getState();
  const empires = state.gameState.empires;
  const player = empires.find(e => !e.isAI);
  if (!player) return [];

  const aiEmpires = empires.filter(e => e.isAI);
  return aiEmpires.map(aiEmpire => {
    // Find the player's relation entry for this AI empire
    const relation = player.diplomacy.find(r => r.empireId === aiEmpire.id);
    const isKnown = relation !== undefined && relation.status !== 'unknown';

    return {
      empire: aiEmpire,
      relation: relation ?? {
        empireId: aiEmpire.id,
        status: 'unknown' as const,
        treaties: [],
        attitude: 0,
        tradeRoutes: 0,
        communicationLevel: 'none' as const,
      },
      trust: relation ? Math.max(0, Math.min(100, 50 + relation.attitude / 2)) : 0,
      incidents: [],
      isKnown,
    };
  });
}

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
  const [gameStarted, setGameStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [saveLoadTab, setSaveLoadTab] = useState<SaveLoadTab | null>(null);
  const [creatorData, setCreatorData] = useState<SpeciesCreatorContinueData | null>(null);
  const [managedPlanet, setManagedPlanet] = useState<Planet | null>(null);
  const [managedSystemId, setManagedSystemId] = useState<string | null>(null);
  const [empireResources, setEmpireResources] = useState<EmpireResources>(EMPTY_RESOURCES);
  const [buildNotification, setBuildNotification] = useState<string | null>(null);
  const [shipProducedNotification, setShipProducedNotification] = useState<string | null>(null);
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
  const [knownEmpires, setKnownEmpires] = useState<KnownEmpire[]>([]);

  // ── Fleet state ──
  const [selectedFleet, setSelectedFleet] = useState<Fleet | null>(null);
  const [fleetShips, setFleetShips] = useState<Ship[]>([]);

  // ── Battle results overlay (shown when a CombatResolved event fires) ──
  const [battleResults, setBattleResults] = useState<BattleResultsData | null>(null);

  // ── Espionage state ──
  const [espionageState, setEspionageState] = useState<EspionageState>(() =>
    initialiseEspionage(['player', 'nk_hegemony', 'veth_republic']),
  );
  // setEspionageEventLog will be wired to engine events once the game loop is integrated
  const [espionageEventLog, _setEspionageEventLog] = useState<EspionageEvent[]>([]);

  // ── Victory state ──
  const [victoryData, setVictoryData] = useState<{
    winnerEmpireId: string;
    winnerEmpireName: string;
    victoryCriteria: string;
    allProgress: VictoryProgress[];
    empireNames: Record<string, string>;
    empireColours: Record<string, string>;
    statistics: GameStatistics;
  } | null>(null);

  // ── Victory tracker (in-game HUD) ──
  const [playerVictoryProgress, setPlayerVictoryProgress] = useState<VictoryProgress | null>(null);
  const [victoryTrackerCollapsed, setVictoryTrackerCollapsed] = useState(true);
  const [currentTick, setCurrentTick] = useState(0);

  // ── Event log entries ──
  const [eventLogEntries, setEventLogEntries] = useState<GameLogEntry[]>([]);

  /** Push a new event log entry, capping at 50 to limit memory. */
  const pushLogEntry = useCallback((tick: number, message: string, category: GameLogEntry['category'] = 'general') => {
    setEventLogEntries(prev => {
      const entry = createLogEntry(tick, message, category);
      const next = [...prev, entry];
      return next.length > 50 ? next.slice(-50) : next;
    });
  }, []);

  // ── Notification queue (auto-pause popups) ──
  const [notificationQueue, setNotificationQueue] = useState<GameNotification[]>([]);
  const [activeNotification, setActiveNotification] = useState<GameNotification | null>(null);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(() => {
    try {
      const stored = localStorage.getItem('ex-nihilo:silenced-notifications');
      if (stored) {
        const arr = JSON.parse(stored) as NotificationType[];
        return { silencedTypes: new Set(arr) };
      }
    } catch { /* ignore */ }
    return { silencedTypes: new Set() };
  });

  // ── "Coming Soon" overlay state ──
  const [comingSoonLabel, _setComingSoonLabel] = useState<string | null>(null);

  // ── Migration state ──
  // All active (in_progress) migrations, updated by engine events.
  const [activeMigrations, setActiveMigrations] = useState<MigrationOrder[]>([]);

  // ── Audio SFX ──────────────────────────────────────────────────────────────
  // Lazily initialised when the AudioEngine becomes available (requires user
  // interaction to unlock the Web Audio context).
  const sfxRef = useRef<SfxGenerator | null>(null);

  /** Return the SFX generator, creating it on first access if possible. */
  const getSfx = useCallback((): SfxGenerator | null => {
    if (!sfxRef.current) {
      const audioEngine = getAudioEngine();
      if (audioEngine) {
        sfxRef.current = new SfxGenerator(audioEngine);
      }
    }
    return sfxRef.current;
  }, []);

  // Estimated total waves for migration UI (constant for now)
  const estimatedWavesForMigration = useMemo(() => estimateTotalWaves(), []);

  // ── Known empire map (id → { name, color }) for PlanetDetailPanel ──
  const knownEmpireMap = useMemo((): Map<string, { name: string; color: string }> => {
    const map = new Map<string, { name: string; color: string }>();
    for (const ke of knownEmpires) {
      map.set(ke.empire.id, { name: ke.empire.name, color: ke.empire.color });
    }
    return map;
  }, [knownEmpires]);

  // ── Empire name map (id → name) for SystemInfoPanel owner display ──
  // Includes the player empire and all known empires so the system panel
  // shows empire names rather than raw UUIDs.
  const empireNameMap = useMemo((): Map<string, string> => {
    const map = new Map<string, string>();
    map.set(playerEmpire.id, playerEmpire.name);
    for (const ke of knownEmpires) {
      map.set(ke.empire.id, ke.empire.name);
    }
    // Also include any empires from the live engine state that may not be in
    // the mock known-empires list.
    const engine = getGameEngine();
    if (engine) {
      for (const emp of engine.getState().gameState.empires) {
        if (!map.has(emp.id)) {
          map.set(emp.id, emp.name);
        }
      }
    }
    return map;
  }, [playerEmpire, knownEmpires]);

  // ── Derive active migration info for the currently selected planet ──
  const activeMigrationForPanel = useMemo((): ActiveMigrationInfo | null => {
    if (!selectedPlanet) return null;
    const mig = activeMigrations.find(m => m.targetPlanetId === selectedPlanet.id);
    if (!mig) return null;

    // Resolve the source planet name from the current galaxy state
    const engine = getGameEngine();
    let sourceName = mig.sourcePlanetId;
    if (engine) {
      const system = engine.getState().gameState.galaxy.systems.find(
        s => s.id === mig.systemId,
      );
      const sourcePlanet = system?.planets.find(p => p.id === mig.sourcePlanetId);
      if (sourcePlanet) sourceName = sourcePlanet.name;
    }

    return {
      arrivedPopulation: mig.arrivedPopulation,
      threshold: mig.threshold,
      ticksToNextWave: mig.ticksToNextWave,
      status: mig.status,
      sourcePlanetName: sourceName,
      colonistsLost: mig.colonistsLost,
      currentWave: mig.currentWave,
    };
  }, [selectedPlanet, activeMigrations]);

  // ── Derive source planet name hint for the colonise panel ──
  // Show the first owned planet in the current system as the migration source.
  const migrationSourcePlanetName = useMemo((): string | null => {
    if (!selectedPlanet) return null;
    const systemId = activeSystemId ?? selectedSystem?.id;
    if (!systemId) return null;
    const engine = getGameEngine();
    if (!engine) return null;
    const system = engine.getState().gameState.galaxy.systems.find(s => s.id === systemId);
    const owned = system?.planets.find(
      p => p.ownerId !== null && p.id !== selectedPlanet.id,
    );
    return owned?.name ?? null;
  }, [selectedPlanet, activeSystemId, selectedSystem]);

  // ── Determine whether the player owns at least one planet in the active system ──
  // Required for in-system colonisation eligibility (Bug 2 fix).
  const playerOwnsInSystem = useMemo((): boolean => {
    const systemId = activeSystemId ?? selectedSystem?.id;
    if (!systemId || !playerEmpire) return false;
    const engine = getGameEngine();
    if (!engine) return false;
    const system = engine.getState().gameState.galaxy.systems.find(s => s.id === systemId);
    if (!system) return false;
    return system.planets.some(p => p.ownerId === playerEmpire.id);
  }, [activeSystemId, selectedSystem, playerEmpire]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts when focus is inside a text input
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (currentScreen === 'game') {
        switch (e.key) {
          case 'Escape':
            // Only toggle pause when a game is in progress; on the main menu
            // there is nothing to pause.
            if (gameStarted) {
              setIsPaused((prev) => !prev);
              e.preventDefault();
            }
            break;
          case ' ':
            // Space: toggle pause (only while game is running)
            if (gameStarted) {
              setIsPaused((prev) => !prev);
              e.preventDefault();
            }
            break;
          case '1':
            if (gameStarted) setGameSpeed('paused');
            break;
          case '2':
            if (gameStarted) setGameSpeed('slow');
            break;
          case '3':
            if (gameStarted) setGameSpeed('normal');
            break;
          case '4':
            if (gameStarted) setGameSpeed('fast');
            break;
          case '5':
            if (gameStarted) setGameSpeed('fastest');
            break;
          case 'r':
          case 'R':
            if (gameStarted) setCurrentScreen('research');
            break;
          case 's':
          case 'S':
            if (gameStarted) setCurrentScreen('ship-designer');
            break;
          case 'd':
          case 'D':
            if (gameStarted) setCurrentScreen('diplomacy');
            break;
          case 'f':
          case 'F':
            if (gameStarted) setCurrentScreen('fleet');
            break;
          case 'e':
          case 'E':
            if (gameStarted) setCurrentScreen('economy');
            break;
        }
      } else if (e.key === 'Escape') {
        // Close any full-screen overlay back to game view
        setCurrentScreen('game');
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentScreen, gameStarted, setGameSpeed]);

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

  // Phaser emits this when "Resume" is clicked — open the save/load screen in load mode
  const handleOpenLoadGame = useCallback(() => {
    setSaveLoadTab('load');
  }, []);

  // Expose a direct window callback for MainMenuScene to call — more reliable than event bridge
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__EX_NIHILO_OPEN_LOAD__ = () => setSaveLoadTab('load');
    (window as unknown as Record<string, unknown>).__EX_NIHILO_OPEN_NEW_GAME__ = () => {
      setCurrentScreen('species-creator');
      setIsPaused(false);
    };
    return () => {
      delete (window as unknown as Record<string, unknown>).__EX_NIHILO_OPEN_LOAD__;
      delete (window as unknown as Record<string, unknown>).__EX_NIHILO_OPEN_NEW_GAME__;
    };
  }, []);

  // Phaser emits this when "Multiplayer" is clicked from the main menu
  const handleOpenMultiplayer = useCallback(() => {
    setCurrentScreen('multiplayer');
    setIsPaused(false);
  }, []);

  const handleCloseMultiplayer = useCallback(() => {
    setCurrentScreen('game');
  }, []);

  const handleMultiplayerGameStart = useCallback((_galaxyConfig: LobbyGalaxyConfig) => {
    // TODO: wire up multiplayer game launch – for now return to the main screen
    // The galaxy config will be used to kick off the Phaser GalaxyMapScene.
    setCurrentScreen('game');
    setGameStarted(true);
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

  // Play ominous horn when the player declares war
  const handleDeclareWar = useCallback((_targetEmpireId: string) => {
    const audioEngine = getAudioEngine();
    if (audioEngine) {
      const sfx = new SfxGenerator(audioEngine);
      sfx.playWarDeclared();
    }
  }, []);

  // Play gentle bell when a treaty is signed
  const handleProposeTreaty = useCallback((_targetEmpireId: string, _type: import('@nova-imperia/shared').TreatyType) => {
    const audioEngine = getAudioEngine();
    if (audioEngine) {
      const sfx = new SfxGenerator(audioEngine);
      sfx.playTreatySign();
    }
  }, []);

  // Fleet, Economy, Espionage button handlers for TopBar
  const handleOpenFleetList = useCallback(() => {
    setCurrentScreen('fleet');
  }, []);

  const handleOpenEconomy = useCallback(() => {
    setCurrentScreen('economy');
  }, []);

  const handleOpenEspionage = useCallback(() => {
    setCurrentScreen('espionage');
  }, []);

  const handleCloseEspionage = useCallback(() => {
    setCurrentScreen('game');
  }, []);

  const handleCloseEconomy = useCallback(() => {
    setCurrentScreen('game');
  }, []);

  const handleRecruitSpy = useCallback((agent: SpyAgent) => {
    setEspionageState((prev) => addAgentToState(prev, agent));
  }, []);

  const handleAssignMission = useCallback(
    (agentId: string, targetEmpireId: string, mission: SpyMission) => {
      setEspionageState((prev) => {
        const agent = prev.agents.find((a) => a.id === agentId);
        if (!agent) return prev;
        const updated = assignMission(agent, targetEmpireId, mission);
        return {
          ...prev,
          agents: prev.agents.map((a) => (a.id === agentId ? updated : a)),
          counterIntelLevel: new Map(prev.counterIntelLevel),
        };
      });
    },
    [],
  );

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
      // Refresh the selected planet from engine state so the panel updates
      const engine = getGameEngine();
      if (engine) {
        const system = engine.getState().gameState.galaxy.systems.find(s => s.id === payload.systemId);
        const updatedPlanet = system?.planets.find(p => p.id === payload.planetId);
        if (updatedPlanet) {
          setSelectedPlanet(updatedPlanet);
        }
      }
      const tick = engine?.getState().gameState.currentTick ?? 0;
      pushLogEntry(tick, `Colony established on ${payload.planetName}`, 'colony');
    },
    [setSelectedPlanet, pushLogEntry],
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
  // Also refreshes the selected planet so PlanetDetailPanel never shows stale
  // ownership / migration state (fixes Bug 1 & 6).
  const handleEngineTick = useCallback(() => {
    // Sync player empire and diplomacy state from engine
    const engine: GameEngine | undefined = getGameEngine();
    if (engine) {
      const state = engine.getState();
      const tick = state.gameState.currentTick;
      setCurrentTick(tick);
      const playerEmp = state.gameState.empires.find(e => !e.isAI);
      if (playerEmp) setPlayerEmpire(playerEmp);
      // Refresh known empires from live engine state
      setKnownEmpires(buildKnownEmpiresFromEngine(engine));

      // Update VictoryTracker every 10 ticks to avoid per-tick overhead
      if (playerEmp && tick % 10 === 0) {
        const progress = calculateVictoryProgress(
          playerEmp,
          state.gameState,
          state.gameState.empires,
          state.empireResourcesMap,
        );
        setPlayerVictoryProgress(progress);
      }
    }

    // Refresh selected planet from engine so the panel never shows stale data
    if (selectedPlanet) {
      const eng: GameEngine | undefined = getGameEngine();
      if (eng) {
        const systems = eng.getState().gameState.galaxy.systems;
        for (const sys of systems) {
          const found: Planet | undefined = sys.planets.find(p => p.id === selectedPlanet.id);
          if (found && found !== selectedPlanet) {
            setSelectedPlanet(found);
            break;
          }
        }
      }
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
            // Log to event log
            const tick = state.gameState.currentTick ?? 0;
            pushLogEntry(tick, `Construction complete: ${def.name} on ${latestPlanet.name}`, 'construction');
          }
          // Play build-complete SFX
          getSfx()?.playBuildComplete();
        }
      }

      return latestPlanet;
    });
  }, [managedSystemId, selectedPlanet, setSelectedPlanet, getSfx, pushLogEntry]);

  // Engine emits 'engine:viewport_changed' each frame from GalaxyMapScene
  const handleViewportChanged = useCallback(
    (vp: { x: number; y: number; width: number; height: number }) => {
      setViewport(vp);
    },
    [],
  );

  // Engine emits 'engine:resources_updated' each tick with full per-empire resource stockpiles
  const handleEngineResourcesUpdated = useCallback(
    (updates: Array<{ empireId: string; credits: number; researchPoints: number; minerals: number; energy: number; organics: number; rareElements: number; exoticMaterials: number; faith: number }>) => {
      if (updates.length > 0) {
        const playerEntry = updates[0]!;
        setLiveCredits(playerEntry.credits);
        setLiveResearchPoints(playerEntry.researchPoints);
        // Sync full resource stockpile for building picker affordability
        setEmpireResources({
          credits: playerEntry.credits,
          minerals: playerEntry.minerals,
          energy: playerEntry.energy,
          organics: playerEntry.organics,
          rareElements: playerEntry.rareElements,
          exoticMaterials: playerEntry.exoticMaterials,
          faith: playerEntry.faith,
          researchPoints: playerEntry.researchPoints,
        });
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

  // Engine emits 'engine:ship_produced' when a ship completes construction
  const handleShipProduced = useCallback(
    (payload: { shipName: string; systemId: string }) => {
      const message = `Ship produced: ${payload.shipName}`;
      setShipProducedNotification(message);
      setTimeout(() => setShipProducedNotification(null), 4000);
      getSfx()?.playShipLaunch();
      // Look up system name for better log message
      const engine = getGameEngine();
      const tick = engine?.getState().gameState.currentTick ?? 0;
      const system = engine?.getState().gameState.galaxy.systems.find(s => s.id === payload.systemId);
      const systemName = system?.name ?? payload.systemId;
      pushLogEntry(tick, `Ship produced: ${payload.shipName} at ${systemName}`, 'ship');
    },
    [getSfx, pushLogEntry],
  );

  // Engine emits 'engine:migrations_updated' after any migration state change
  // (started, wave, completed, cancelled).
  const handleMigrationsUpdated = useCallback((migrations: MigrationOrder[]) => {
    setActiveMigrations([...migrations]);
  }, []);

  // Engine emits 'engine:migration_started' when a migration begins.
  const handleMigrationStarted = useCallback(() => {
    getSfx()?.playColoniseStart();
    const engine = getGameEngine();
    const tick = engine?.getState().gameState.currentTick ?? 0;
    pushLogEntry(tick, 'Migration wave: colonists departed', 'migration');
  }, [getSfx, pushLogEntry]);

  // Engine emits 'engine:migration_completed' when threshold reached.
  const handleMigrationCompleted = useCallback((migration: MigrationOrder) => {
    setColoniseNotification(migration.targetPlanetId);
    // Refresh the planet panel so it shows owned state
    const engine = getGameEngine();
    if (engine) {
      const system = engine.getState().gameState.galaxy.systems.find(
        s => s.id === migration.systemId,
      );
      const updated = system?.planets.find(p => p.id === migration.targetPlanetId);
      if (updated) {
        setSelectedPlanet(updated);
        const tick = engine.getState().gameState.currentTick ?? 0;
        pushLogEntry(tick, `Colony established on ${updated.name}`, 'colony');
      }
    }
    getSfx()?.playColoniseComplete();
  }, [setSelectedPlanet, getSfx, pushLogEntry]);

  // Engine emits 'engine:tech_researched' when a technology finishes.
  const handleTechResearched = useCallback((payload: unknown) => {
    getSfx()?.playResearchComplete();
    const data = payload as { techId?: string; tick?: number } | undefined;
    const techId = data?.techId ?? 'Unknown';
    const tick = data?.tick ?? 0;
    // Look up tech name from allTechs
    const tech = allTechs.find(t => t.id === techId);
    const techName = tech?.name ?? techId;
    pushLogEntry(tick, `Research complete: ${techName}`, 'research');
  }, [getSfx, allTechs, pushLogEntry]);

  // Engine emits 'engine:battle_resolved' (enriched) when combat concludes.
  // The engine has already paused itself; we show the battle results overlay
  // and resume when the player dismisses it.
  const handleBattleResolved = useCallback(
    (data: BattleResultsData) => {
      setBattleResults(data);
      // Determine if the player empire won
      const playerWon = data.winner === 'attacker'
        ? data.attacker.empireName !== 'Unknown Empire' // attacker is player
        : data.winner === 'defender';
      getSfx()?.playBattleResult(playerWon);
      const engine = getGameEngine();
      const tick = engine?.getState().gameState.currentTick ?? 0;
      const systemName = data.systemName ?? 'unknown system';
      pushLogEntry(tick, `Enemy fleet detected at ${systemName}`, 'combat');
    },
    [getSfx, pushLogEntry],
  );

  const handleBattleContinue = useCallback(() => {
    setBattleResults(null);
    // Resume the engine
    const engine = getGameEngine();
    if (engine) engine.start();
  }, []);

  // Engine emits 'engine:game_over' when the game ends (victory / defeat).
  const handleGameOver = useCallback((_payload: { winnerId?: string; reason?: string }) => {
    const engine = getGameEngine();
    if (!engine) return;

    const state = engine.getState();
    const empires = state.gameState.empires;
    const player = empires.find(e => !e.isAI);
    const playerId = player?.id ?? '';

    // Determine winner — prefer winnerId from payload, fall back to first empire
    const winnerId = _payload.winnerId ?? playerId;
    const winnerEmpire = empires.find(e => e.id === winnerId);

    // Build victory progress for all empires
    const allProgress = empires.map(e =>
      calculateVictoryProgress(e, state.gameState, empires, state.empireResourcesMap),
    );

    // Build name and colour maps
    const empireNames: Record<string, string> = {};
    const empireColours: Record<string, string> = {};
    for (const e of empires) {
      empireNames[e.id] = e.name;
      empireColours[e.id] = e.color ?? '#888888';
    }

    // Gather statistics for the local player
    const ownedPlanets = state.gameState.galaxy.systems
      .flatMap(s => s.planets)
      .filter(p => p.ownerId === playerId);
    const playerShips = state.gameState.ships.filter(s => {
      const fleet = state.gameState.fleets.find(f => f.id === s.fleetId);
      return fleet?.empireId === playerId;
    });
    const playerResearch = state.researchStates.get(playerId);

    const statistics: GameStatistics = {
      ticksPlayed: state.gameState.currentTick,
      planetsColonised: ownedPlanets.length,
      shipsBuilt: playerShips.length,
      techsResearched: playerResearch?.completedTechs.length ?? 0,
    };

    setVictoryData({
      winnerEmpireId: winnerId,
      winnerEmpireName: winnerEmpire?.name ?? 'Unknown',
      victoryCriteria: _payload.reason ?? 'conquest',
      allProgress,
      empireNames,
      empireColours,
      statistics,
    });
    setCurrentScreen('victory');
  }, []);

  // ── Notification system ────────────────────────────────────────────────────

  /** Push a notification onto the queue.  If nothing is active, show it immediately and pause. */
  const pushNotification = useCallback((notification: GameNotification) => {
    // Always log the notification in the event log
    const category: GameLogEntry['category'] =
      notification.priority === 'critical' ? 'combat'
        : notification.priority === 'warning' ? 'colony'
          : 'general';
    pushLogEntry(notification.tick, notification.title, category);

    // If the player has silenced this type and it is silenceable, skip the popup
    if (!shouldShowNotification(notification, notificationPreferences)) return;

    // If no notification is currently shown, display this one and pause
    if (!activeNotification) {
      setActiveNotification(notification);
      if (notification.autoPause) {
        const engine = getGameEngine();
        if (engine) engine.pause();
      }
    } else {
      // Queue behind the currently displayed notification
      setNotificationQueue(prev => [...prev, notification]);
    }
  }, [activeNotification, notificationPreferences, pushLogEntry]);

  /** Dismiss the active notification.  If `silenceType` is true, persist the preference. */
  const handleNotificationDismiss = useCallback((silenceType: boolean) => {
    if (activeNotification && silenceType && activeNotification.canSilence) {
      setNotificationPreferences(prev => {
        const next = new Set(prev.silencedTypes);
        next.add(activeNotification.type);
        try {
          localStorage.setItem(
            'ex-nihilo:silenced-notifications',
            JSON.stringify([...next]),
          );
        } catch { /* ignore quota errors */ }
        return { silencedTypes: next };
      });
    }

    // Show next queued notification, or resume the engine if the queue is empty
    setNotificationQueue(prev => {
      if (prev.length > 0) {
        const [next, ...rest] = prev;
        setActiveNotification(next);
        return rest;
      }
      // Queue empty — clear active and resume engine
      setActiveNotification(null);
      const engine = getGameEngine();
      if (engine) engine.start();
      return prev;
    });
  }, [activeNotification]);

  /** Handle a choice being made on a notification. */
  const handleNotificationChoice = useCallback((choiceId: string) => {
    if (choiceId === 'open_research') {
      setCurrentScreen('research');
    }
  }, []);

  /** Listen for notifications emitted by the engine. */
  const handleEngineNotification = useCallback((notification: GameNotification) => {
    pushNotification(notification);
  }, [pushNotification]);

  // Player clicks "Cancel Migration" in PlanetDetailPanel
  const handleCancelMigration = useCallback(() => {
    if (!selectedPlanet) return;
    const engine = getGameEngine();
    if (engine) {
      engine.stopMigration(selectedPlanet.id);
    }
  }, [selectedPlanet]);

  useGameEvent<StarSystem>('system:selected', handleSystemSelected);
  useGameEvent<Planet>('planet:selected', handlePlanetSelected);
  useGameEvent<void>('system:deselected', handleSystemDeselected);
  useGameEvent<void>('planet:deselected', handlePlanetDeselected);
  useGameEvent<{ systemId: string }>('system:entered', handleSystemEntered);
  useGameEvent<void>('system:exited', handleSystemExited);
  useGameEvent<string>('scene:change', handleSceneChange);
  useGameEvent<void>('ui:new_game', handleNewGame);
  useGameEvent<void>('ui:load_game', handleOpenLoadGame);
  useGameEvent<void>('ui:multiplayer', handleOpenMultiplayer);
  useGameEvent<void>('ui:settings', useCallback(() => setIsPaused(true), []));
  useGameEvent<void>('ui:research', handleOpenResearch);
  useGameEvent<void>('ui:ship_designer', handleOpenShipDesigner);
  useGameEvent<void>('ui:diplomacy', handleOpenDiplomacy);
  useGameEvent<Empire>('empire:updated', handleEmpireUpdate);
  useGameEvent<{ planet: Planet; systemId: string }>('planet:manage', handleManagePlanet);
  useGameEvent<EmpireResources>('empire:resources_updated', handleResourcesUpdate);
  useGameEvent<ResearchState>('research:state_updated', handleResearchStateUpdate);
  useGameEvent<ResearchState>('engine:research_state', handleResearchStateUpdate);
  useGameEvent<Technology[]>('research:techs_loaded', handleTechsLoaded);
  useGameEvent<{ fleet: Fleet; ships: Ship[] }>('fleet:selected', handleFleetSelected);
  useGameEvent<void>('fleet:deselected', handleFleetDeselected);
  // Engine events
  useGameEvent<Galaxy>('engine:galaxy_updated', handleGalaxyUpdated);
  useGameEvent<{ x: number; y: number; width: number; height: number }>('engine:viewport_changed', handleViewportChanged);
  useGameEvent<Array<{ empireId: string; credits: number; researchPoints: number; minerals: number; energy: number; organics: number; rareElements: number; exoticMaterials: number; faith: number }>>('engine:resources_updated', handleEngineResourcesUpdated);
  useGameEvent<{ systemId: string; planet: Planet }>('engine:planet_updated', handlePlanetUpdated);
  useGameEvent<{ tick: number }>('engine:tick', handleEngineTick);
  useGameEvent<{ planetName: string; systemId: string; planetId: string }>('engine:planet_colonised', handlePlanetColonised);
  useGameEvent<{ shipName: string; systemId: string }>('engine:ship_produced', handleShipProduced);
  useGameEvent<MigrationOrder[]>('engine:migrations_updated', handleMigrationsUpdated);
  useGameEvent<void>('engine:migration_started', handleMigrationStarted);
  useGameEvent<MigrationOrder>('engine:migration_completed', handleMigrationCompleted);
  useGameEvent<unknown>('engine:tech_researched', handleTechResearched);
  useGameEvent<BattleResultsData>('engine:battle_resolved', handleBattleResolved);
  useGameEvent<{ winnerId?: string; reason?: string }>('engine:game_over', handleGameOver);
  useGameEvent<GameNotification>('engine:notification', handleEngineNotification);

  const handleClosePlanet = useCallback(() => {
    setSelectedPlanet(null);
  }, [setSelectedPlanet]);

  const handleCloseManagedPlanet = useCallback(() => {
    setManagedPlanet(null);
    setManagedSystemId(null);
  }, []);

  // ── All colonised planets owned by the player (for planet navigation arrows) ──
  const allColonisedPlanets = useMemo((): Array<{ planet: Planet; systemId: string }> => {
    const engine = getGameEngine();
    if (!engine) return [];
    const state = engine.getState();
    const player = state.gameState.empires.find(e => !e.isAI);
    if (!player) return [];
    const result: Array<{ planet: Planet; systemId: string }> = [];
    for (const system of state.gameState.galaxy.systems) {
      for (const p of system.planets) {
        if (p.ownerId === player.id) {
          result.push({ planet: p, systemId: system.id });
        }
      }
    }
    return result;
  }, [galaxy, playerEmpire]);

  const handleChangePlanet = useCallback((planet: Planet, systemId: string) => {
    setManagedPlanet(planet);
    setManagedSystemId(systemId);
  }, []);

  const handleDemolish = useCallback(
    (planetId: string, buildingId: string) => {
      if (!managedSystemId) {
        console.warn('[App.handleDemolish] No system ID for managed planet');
        return;
      }
      const engine: GameEngine | undefined = getGameEngine();
      if (!engine) {
        console.warn('[App.handleDemolish] GameEngine not available');
        return;
      }
      const success = engine.demolishBuildingOnPlanet(managedSystemId, planetId, buildingId);
      if (!success) {
        console.warn(`[App.handleDemolish] demolishBuildingOnPlanet returned false for ${buildingId}`);
      }
    },
    [managedSystemId],
  );

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

  const handleProduceShip = useCallback(
    (planetId: string, design: import('@nova-imperia/shared').ShipDesign) => {
      if (!managedSystemId) {
        console.warn('[App.handleProduceShip] No system ID for managed planet');
        return;
      }
      const engine: GameEngine | undefined = getGameEngine();
      if (!engine) {
        console.warn('[App.handleProduceShip] GameEngine not available');
        return;
      }
      const success = engine.produceShip(managedSystemId, planetId, design);
      if (!success) {
        console.warn(`[App.handleProduceShip] produceShip returned false for design ${design.id}`);
      }
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
    const engine: GameEngine | undefined = getGameEngine();
    if (engine) {
      // Delegate to the engine which updates its authoritative researchStates map
      // and emits 'engine:research_state' so the screen refreshes immediately.
      const empireId = engine.getState().gameState.empires.find(e => !e.isAI)?.id;
      if (empireId) {
        engine.startResearch(empireId, techId, allocation);
        return;
      }
    }
    // Fallback: engine not yet available (e.g. pre-game screen), use local state.
    setResearchState((prev) => {
      if (prev.completedTechs.includes(techId)) return prev;
      if (prev.activeResearch.some((r) => r.techId === techId)) return prev;
      const newActive = [...prev.activeResearch, { techId, pointsInvested: 0, allocation: 0 }];
      // Auto-redistribute evenly
      const evenShare = Math.floor(100 / newActive.length);
      const rem = 100 - evenShare * newActive.length;
      const redistributed = newActive.map((r, i) => ({
        ...r,
        allocation: evenShare + (i === 0 ? rem : 0),
      }));
      return { ...prev, activeResearch: redistributed };
    });
  }, []);

  const handleCancelResearch = useCallback((techId: string) => {
    const engine: GameEngine | undefined = getGameEngine();
    if (engine) {
      const empireId = engine.getState().gameState.empires.find(e => !e.isAI)?.id;
      if (empireId) {
        engine.cancelResearch(empireId, techId);
        return;
      }
    }
    // Fallback — redistribute evenly after removal
    setResearchState((prev) => {
      const remaining = prev.activeResearch.filter((r) => r.techId !== techId);
      if (remaining.length > 0) {
        const evenShare = Math.floor(100 / remaining.length);
        const rem = 100 - evenShare * remaining.length;
        remaining.forEach((r, i) => { r.allocation = evenShare + (i === 0 ? rem : 0); });
      }
      return { ...prev, activeResearch: remaining };
    });
  }, []);

  const handleAdjustAllocation = useCallback((techId: string, allocation: number) => {
    const engine: GameEngine | undefined = getGameEngine();
    if (engine) {
      const empireId = engine.getState().gameState.empires.find(e => !e.isAI)?.id;
      if (empireId) {
        engine.adjustResearchAllocation(empireId, techId, allocation);
        return;
      }
    }
    // Fallback
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
  }, []);

  const handleQueueResearch = useCallback((techId: string) => {
    const engine: GameEngine | undefined = getGameEngine();
    if (engine) {
      const empireId = engine.getState().gameState.empires.find(e => !e.isAI)?.id;
      if (empireId) {
        engine.queueResearch(empireId, techId);
        return;
      }
    }
    setResearchState((prev) => ({
      ...prev,
      researchQueue: [...(prev.researchQueue ?? []), techId],
    }));
  }, []);

  const handleDequeueResearch = useCallback((techId: string) => {
    const engine: GameEngine | undefined = getGameEngine();
    if (engine) {
      const empireId = engine.getState().gameState.empires.find(e => !e.isAI)?.id;
      if (empireId) {
        engine.dequeueResearch(empireId, techId);
        return;
      }
    }
    setResearchState((prev) => ({
      ...prev,
      researchQueue: (prev.researchQueue ?? []).filter(id => id !== techId),
    }));
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
  const handleStartGame = useCallback((config: GameConfig) => {
    // Reset stale game-session state so the new game starts clean
    setSaveLoadTab(null);
    setSelectedSystem(null);
    setSelectedPlanet(null);
    setActiveSystemId(null);
    setGalaxy(null);
    setLiveCredits(undefined);
    setLiveResearchPoints(undefined);
    setEmpireResources(EMPTY_RESOURCES);
    setResearchState(MOCK_RESEARCH_STATE);
    setAllTechs(UNIVERSAL_TECHNOLOGIES);
    setKnownEmpires([]);
    setSavedDesigns([]);
    setSelectedFleet(null);
    setFleetShips([]);
    setBattleResults(null);
    setActiveMigrations([]);
    setPlayerVictoryProgress(null);
    setCurrentTick(0);
    setEventLogEntries([]);
    setManagedPlanet(null);
    setManagedSystemId(null);
    setGameSpeed('normal');
    // Apply empire name and government from setup to the player empire state
    setPlayerEmpire(prev => ({
      ...prev,
      name: config.empireName || prev.name,
      government: config.government ?? prev.government,
    }));
    setCurrentScreen('game');
    setGameStarted(true);
    setIsPaused(false);
  }, [setSelectedSystem, setSelectedPlanet, setGameSpeed]);

  // Pause menu
  const handleResume = useCallback(() => {
    setIsPaused(false);
  }, []);

  // Save / Load screen
  const handleOpenSave = useCallback(() => {
    setSaveLoadTab('save');
  }, []);

  const handleOpenLoad = useCallback(() => {
    setSaveLoadTab('load');
  }, []);

  const handleCloseSaveLoad = useCallback(() => {
    setSaveLoadTab(null);
  }, []);

  const handleGameLoaded = useCallback(() => {
    setSaveLoadTab(null);
    setIsPaused(false);
    setGameStarted(true);
  }, []);

  const handleExitToMainMenu = useCallback(() => {
    setIsPaused(false);
    setGameStarted(false);
    setSaveLoadTab(null);
    setCurrentScreen('game');
    // Reset all game-session state so a new game starts fresh
    setSelectedSystem(null);
    setSelectedPlanet(null);
    setActiveSystemId(null);
    setGalaxy(null);
    setLiveCredits(undefined);
    setLiveResearchPoints(undefined);
    setEmpireResources(EMPTY_RESOURCES);
    setResearchState(MOCK_RESEARCH_STATE);
    setAllTechs(UNIVERSAL_TECHNOLOGIES);
    setPlayerEmpire(MOCK_PLAYER_EMPIRE);
    setKnownEmpires([]);
    setSavedDesigns([]);
    setSelectedFleet(null);
    setFleetShips([]);
    setBattleResults(null);
    setActiveMigrations([]);
    setPlayerVictoryProgress(null);
    setCurrentTick(0);
    setEventLogEntries([]);
    setManagedPlanet(null);
    setManagedSystemId(null);
    setGameSpeed('normal');
    // Tell Phaser to go back to the main menu scene
    const game = (window as unknown as Record<string, unknown>).__EX_NIHILO_GAME__ as
      | { scene: { start: (key: string) => void }; events: { emit: (e: string) => void } }
      | undefined;
    if (game) {
      // Stop all scenes and restart main menu
      game.events.emit('ui:exit_to_menu');
    }
  }, [setSelectedSystem, setSelectedPlanet, setGameSpeed]);

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
          onBack={handleBackFromSetup}
          onStartGame={handleStartGame}
        />
      </div>
    );
  }

  // Render research screen as full-screen overlay
  if (currentScreen === 'research') {
    // Derive research production per tick from the engine (accurate ETA display).
    // Falls back to a sensible default when the engine is unavailable.
    const engineForResearch = getGameEngine();
    const researchProductionPerTick = engineForResearch
      ? engineForResearch.getPlayerResearchProductionPerTick()
      : 0;
    const researchLabCount = engineForResearch
      ? engineForResearch.getPlayerResearchLabCount()
      : 1;
    // Species research bonus: traits.research / 5 (5 = normal, 10 = double, etc.)
    const speciesResearchBonus = playerEmpire.species.traits.research / 5;
    return (
      <div className="ui-overlay">
        <ResearchScreen
          allTechs={allTechs}
          researchState={researchState}
          researchPerTick={researchProductionPerTick}
          speciesBonus={speciesResearchBonus}
          maxActiveResearch={researchLabCount}
          onStartResearch={handleStartResearch}
          onCancelResearch={handleCancelResearch}
          onQueueResearch={handleQueueResearch}
          onDequeueResearch={handleDequeueResearch}
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
          currentTurn={getGameEngine()?.getState().gameState.currentTick ?? 0}
          onClose={handleCloseDiplomacy}
          onDeclareWar={handleDeclareWar}
          onProposeTreaty={handleProposeTreaty}
        />
      </div>
    );
  }

  // Render multiplayer lobby as full-screen overlay
  if (currentScreen === 'multiplayer') {
    return (
      <div className="ui-overlay">
        <MultiplayerLobbyScreen
          playerName={playerEmpire.species.name || 'Commander'}
          onBack={handleCloseMultiplayer}
          onGameStart={handleMultiplayerGameStart}
        />
      </div>
    );
  }

  // Render fleet management screen as full-screen overlay
  if (currentScreen === 'fleet') {
    return (
      <div className="ui-overlay">
        <FleetScreen onClose={() => setCurrentScreen('game')} />
      </div>
    );
  }

  // Render espionage screen as full-screen overlay
  if (currentScreen === 'espionage') {
    const knownEmpiresList = knownEmpires
      .filter((ke) => ke.isKnown)
      .map((ke) => ke.empire);
    return (
      <div className="ui-overlay">
        <EspionageScreen
          playerEmpire={playerEmpire}
          knownEmpires={knownEmpiresList}
          espionageState={espionageState}
          eventLog={espionageEventLog}
          playerCredits={liveCredits ?? playerEmpire.credits}
          onClose={handleCloseEspionage}
          onRecruitSpy={handleRecruitSpy}
          onAssignMission={handleAssignMission}
        />
      </div>
    );
  }

  // Render victory screen as full-screen overlay
  if (currentScreen === 'victory' && victoryData) {
    return (
      <div className="ui-overlay">
        <VictoryScreen
          localEmpireId={playerEmpire.id}
          winnerEmpireId={victoryData.winnerEmpireId}
          winnerEmpireName={victoryData.winnerEmpireName}
          victoryCriteria={victoryData.victoryCriteria}
          allProgress={victoryData.allProgress}
          empireNames={victoryData.empireNames}
          empireColours={victoryData.empireColours}
          statistics={victoryData.statistics}
          onNewGame={() => {
            setVictoryData(null);
            setCurrentScreen('species-creator');
            setGameStarted(false);
          }}
          onMainMenu={() => {
            setVictoryData(null);
            handleExitToMainMenu();
          }}
        />
      </div>
    );
  }

  if (currentScreen === 'economy') {
    return (
      <div className="ui-overlay">
        <EconomyScreen
          onClose={handleCloseEconomy}
        />
      </div>
    );
  }

  // Don't render game HUD until a game is actually running
  // But still allow the settings/pause menu overlay and save/load screen from the main menu
  if (!gameStarted) {
    return (
      <div className="ui-overlay">
        {isPaused && !saveLoadTab && (
          <PauseMenu
            onResume={() => setIsPaused(false)}
            onExitToMainMenu={() => setIsPaused(false)}
          />
        )}
        {saveLoadTab && (
          <SaveLoadScreen
            initialTab={saveLoadTab}
            onClose={handleCloseSaveLoad}
            onLoaded={handleGameLoaded}
          />
        )}
        <Tooltip />
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
        minerals={empireResources.minerals}
        energy={empireResources.energy}
        organics={empireResources.organics}
        onOpenResearch={handleOpenResearch}
        onOpenShipDesigner={handleOpenShipDesigner}
        onOpenDiplomacy={handleOpenDiplomacy}
        onOpenFleet={handleOpenFleetList}
        onOpenEconomy={handleOpenEconomy}
        onOpenEspionage={handleOpenEspionage}
        government={playerEmpire.government}
        empireName={playerEmpire.name}
        currentTick={currentTick}
      />

      <SystemInfoPanel system={selectedSystem} empireNameMap={empireNameMap} />

      <PlanetDetailPanel
        planet={selectedPlanet}
        onClose={handleClosePlanet}
        playerEmpire={playerEmpire}
        knownEmpireMap={knownEmpireMap}
        systemId={activeSystemId ?? selectedSystem?.id ?? null}
        activeMigration={activeMigrationForPanel}
        onCancelMigration={handleCancelMigration}
        estimatedWaves={estimatedWavesForMigration}
        sourcePlanetName={migrationSourcePlanetName}
        playerOwnsInSystem={playerOwnsInSystem}
        empireResources={empireResources}
      />

      <Minimap
        systems={galaxy?.systems ?? []}
        galaxyWidth={galaxy?.width ?? 1000}
        galaxyHeight={galaxy?.height ?? 1000}
        viewport={viewport}
      />

      <EventLog entries={eventLogEntries} />

      {playerVictoryProgress && (
        <VictoryTracker
          playerProgress={playerVictoryProgress}
          collapsed={victoryTrackerCollapsed}
          onToggleCollapse={() => setVictoryTrackerCollapsed(prev => !prev)}
        />
      )}

      {managedPlanet && managedSystemId && (
        <PlanetManagementScreen
          planet={managedPlanet}
          systemId={managedSystemId}
          empireResources={empireResources}
          savedDesigns={savedDesigns}
          empireTechs={researchState.completedTechs}
          allColonisedPlanets={allColonisedPlanets}
          onChangePlanet={handleChangePlanet}
          playerSpeciesId={playerEmpire.species.id}
          onClose={handleCloseManagedPlanet}
          onBuild={handleBuild}
          onCancelQueue={handleCancelQueue}
          onProduceShip={handleProduceShip}
          onDemolish={handleDemolish}
        />
      )}

      {buildNotification && (
        <div className="build-notification" role="status" aria-live="polite">
          {buildNotification}
        </div>
      )}

      {shipProducedNotification && (
        <div className="build-notification build-notification--ship" role="status" aria-live="polite">
          {shipProducedNotification}
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
          isSystemView={activeSystemId !== null}
          systemName={
            galaxy?.systems.find(s => s.id === selectedFleet.position.systemId)?.name
            ?? selectedFleet.position.systemId
          }
          onClose={handleFleetDeselected}
        />
      )}

      {/* Coming Soon notification */}
      {comingSoonLabel && (
        <div className="build-notification" role="status" aria-live="polite">
          {comingSoonLabel} — Coming Soon
        </div>
      )}

      {isPaused && !saveLoadTab && (
        <PauseMenu
          onResume={handleResume}
          onExitToMainMenu={handleExitToMainMenu}
          onSaveGame={handleOpenSave}
          onLoadGame={handleOpenLoad}
        />
      )}

      {saveLoadTab && (
        <SaveLoadScreen
          initialTab={saveLoadTab}
          onClose={handleCloseSaveLoad}
          onLoaded={handleGameLoaded}
        />
      )}

      {/* Auto-pause notification popup */}
      {activeNotification !== null && (
        <NotificationPopup
          notification={activeNotification}
          queueLength={notificationQueue.length}
          onDismiss={handleNotificationDismiss}
          onChoice={handleNotificationChoice}
        />
      )}

      {/* Battle results modal — sits above all other overlays */}
      {battleResults !== null && (
        <BattleResultsScreen
          data={battleResults}
          onContinue={handleBattleContinue}
        />
      )}

      {/* Global tooltip — renders near cursor for any element with data-tooltip */}
      <Tooltip />
    </div>
  );
}
