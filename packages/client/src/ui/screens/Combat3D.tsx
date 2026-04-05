/**
 * Combat3D — main React Three Fiber canvas that composes all 3D combat
 * sub-components: environment, ships, weapons, effects, HUD, and input.
 *
 * Owns the R3F <Canvas>, camera setup, lighting, and post-processing.
 * All game-state management is delegated to useCombatState.
 */

import React, { useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import CameraControlsImpl from 'camera-controls';
import type { CombatSceneData } from '../../game/scenes/CombatScene';
import { useCombatState } from './combat3d/useCombatState';
import {
  CombatStarfield,
  BattlefieldGrid,
  EnvironmentFeatures,
  PlanetEdge,
} from './combat3d/CombatEnvironment';
import { CombatShips } from './combat3d/CombatShips';
import { CombatWeapons } from './combat3d/CombatWeapons';
import {
  FighterEffects,
  PointDefenceEffects,
  EscapePodEffects,
  ExplosionEffects,
  DebrisEffects,
} from './combat3d/CombatEffects';
import { CombatHUD } from './combat3d/CombatHUD';
import { CombatInput } from './combat3d/CombatInput';
import { BF_SCALE } from './combat3d/constants';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Combat3DProps {
  combatData: CombatSceneData;
  startBattleRef?: React.MutableRefObject<
    ((formation?: string, stance?: string) => void) | null
  >;
  onBattleEnded?: (state: unknown) => void;
}

// ---------------------------------------------------------------------------
// Inner scene — separated so useFrame / drei hooks are inside <Canvas>
// ---------------------------------------------------------------------------

function CombatScene({
  api,
  combatData,
}: {
  api: ReturnType<typeof useCombatState>;
  combatData: CombatSceneData;
}) {
  const controlsRef = useRef<CameraControlsImpl>(null);

  // Disable left and right mouse buttons on camera controls so CombatInput
  // can handle selection (left) and orders (right).  Middle-click orbits,
  // wheel zooms.
  useEffect(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    ctrl.mouseButtons.left = CameraControlsImpl.ACTION.NONE;
    ctrl.mouseButtons.right = CameraControlsImpl.ACTION.NONE;
    ctrl.mouseButtons.middle = CameraControlsImpl.ACTION.ROTATE;
    ctrl.mouseButtons.wheel = CameraControlsImpl.ACTION.DOLLY;
  }, []);

  const bfW = api.state.battlefieldWidth * BF_SCALE;
  const bfH = api.state.battlefieldHeight * BF_SCALE;
  const camDist = Math.max(bfW, bfH) * 0.8;

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 20, 10]} intensity={0.5} />

      {/* Camera controls */}
      <CameraControls
        ref={controlsRef}
        minDistance={5}
        maxDistance={camDist * 2}
        dollySpeed={0.5}
      />

      {/* Environment */}
      <CombatStarfield />
      <BattlefieldGrid
        width={api.state.battlefieldWidth}
        height={api.state.battlefieldHeight}
      />
      <EnvironmentFeatures state={api.state} />
      <PlanetEdge state={api.state} />

      {/* Ships */}
      <CombatShips api={api} />

      {/* Weapons */}
      <CombatWeapons state={api.state} playerSide={api.playerSide} />

      {/* Effects */}
      <FighterEffects
        state={api.state}
        attackerColor={combatData.attackerColor}
        defenderColor={combatData.defenderColor}
      />
      <PointDefenceEffects state={api.state} />
      <EscapePodEffects state={api.state} />
      <ExplosionEffects api={api} />
      <DebrisEffects state={api.state} />

      {/* Input (invisible — events only) */}
      <CombatInput api={api} />

      {/* Post-processing */}
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.6}
          luminanceSmoothing={0.3}
          intensity={0.8}
        />
        <Vignette darkness={0.5} offset={0.3} />
      </EffectComposer>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function Combat3D({
  combatData,
  startBattleRef,
  onBattleEnded,
}: Combat3DProps) {
  const api = useCombatState(combatData);

  // Expose startBattle to parent via ref
  useEffect(() => {
    if (startBattleRef) startBattleRef.current = api.startBattle;
    return () => {
      if (startBattleRef) startBattleRef.current = null;
    };
  }, [api.startBattle, startBattleRef]);

  // Notify parent when battle ends
  useEffect(() => {
    if (api.battleEnded && onBattleEnded) onBattleEnded(api.state);
  }, [api.battleEnded, onBattleEnded, api.state]);

  // Cleanup on unmount
  useEffect(() => () => api.cleanup(), [api]);

  // Camera: above and behind, looking at centre
  const bfW = api.state.battlefieldWidth * BF_SCALE;
  const bfH = api.state.battlefieldHeight * BF_SCALE;
  const camDist = Math.max(bfW, bfH) * 0.8;

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#06081a' }}>
      <Canvas
        camera={{
          position: [0, camDist, camDist * 0.6],
          fov: 50,
          near: 0.1,
          far: 1000,
        }}
        gl={{ antialias: true }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
      >
        <CombatScene api={api} combatData={combatData} />
      </Canvas>

      {/* HUD overlay (outside Canvas — pure React HTML) */}
      <CombatHUD api={api} />
    </div>
  );
}
