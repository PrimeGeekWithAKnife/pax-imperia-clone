import { useState, useCallback } from 'react';
import type { StarSystem, Planet } from '@nova-imperia/shared';
import type { GameSpeedName } from '@nova-imperia/shared';

export interface GameState {
  selectedSystem: StarSystem | null;
  selectedPlanet: Planet | null;
  currentScene: string;
  gameSpeed: GameSpeedName;
}

export interface GameStateActions {
  setSelectedSystem: (system: StarSystem | null) => void;
  setSelectedPlanet: (planet: Planet | null) => void;
  setCurrentScene: (scene: string) => void;
  setGameSpeed: (speed: GameSpeedName) => void;
}

/**
 * Central game state shared across all UI overlay components.
 * Updated by useGameEvent listeners in App.tsx.
 */
export function useGameState(): GameState & GameStateActions {
  const [selectedSystem, setSelectedSystemRaw] = useState<StarSystem | null>(null);
  const [selectedPlanet, setSelectedPlanetRaw] = useState<Planet | null>(null);
  const [currentScene, setCurrentSceneRaw] = useState<string>('');
  const [gameSpeed, setGameSpeedRaw] = useState<GameSpeedName>('paused');

  const setSelectedSystem = useCallback((system: StarSystem | null) => {
    setSelectedSystemRaw(system);
    // Deselect planet when system changes
    if (system === null) {
      setSelectedPlanetRaw(null);
    }
  }, []);

  const setSelectedPlanet = useCallback((planet: Planet | null) => {
    setSelectedPlanetRaw(planet);
  }, []);

  const setCurrentScene = useCallback((scene: string) => {
    setCurrentSceneRaw(scene);
  }, []);

  const setGameSpeed = useCallback((speed: GameSpeedName) => {
    setGameSpeedRaw(speed);
    // Only emit to Phaser when an active game engine exists; otherwise the
    // event could be mishandled by whichever scene is currently running.
    const engine = (window as unknown as Record<string, unknown>).__GAME_ENGINE__;
    if (!engine) return;
    const game = (window as unknown as Record<string, unknown>).__EX_NIHILO_GAME__ as
      | { events: { emit: (e: string, d: unknown) => void } }
      | undefined;
    game?.events.emit('ui:speed_change', speed);
  }, []);

  return {
    selectedSystem,
    selectedPlanet,
    currentScene,
    gameSpeed,
    setSelectedSystem,
    setSelectedPlanet,
    setCurrentScene,
    setGameSpeed,
  };
}
