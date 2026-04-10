/**
 * useCombatState — React hook that manages the entire combat simulation
 * lifecycle independently of rendering.
 *
 * Owns the tactical tick loop, ship orders, audio triggers, and battle-end
 * detection.  The 3D renderer reads `state` each frame but never mutates it.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  initializeTacticalCombat,
  processTacticalTick,
  setShipOrder,
  setShipStance,
  setFormation,
  getFormationPositions,
  admiralRally,
  admiralEmergencyRepair,
  admiralPause,
} from '@nova-imperia/shared';
import type {
  TacticalState,
  TacticalShip,
  ShipOrder,
  FormationType,
  CombatStance,
} from '@nova-imperia/shared';
import type { CombatSceneData } from '../../../game/scenes/CombatScene';
import { getAudioEngine, SfxGenerator, MusicGenerator } from '../../../audio';
import type { MusicTrack } from '../../../audio';
import {
  SPEED_PRESETS,
  BEAM_STYLE_MAP,
  PROJECTILE_STYLE_MAP,
  MISSILE_STYLE_MAP,
} from './constants';
import type { BeamStyle, MissileStyle } from './constants';

// ---------------------------------------------------------------------------
// Audio tracking refs — passed to the module-level sound helper
// ---------------------------------------------------------------------------

interface AudioTrackingRefs {
  prevBeamKeys: React.MutableRefObject<Set<string>>;
  prevProjectileCount: React.MutableRefObject<number>;
  prevMissileCount: React.MutableRefObject<number>;
  prevMissileIds: React.MutableRefObject<Set<string>>;
  prevShields: React.MutableRefObject<Map<string, number>>;
  prevDestroyed: React.MutableRefObject<Set<string>>;
  sfx: React.MutableRefObject<SfxGenerator | null>;
}

// ---------------------------------------------------------------------------
// Module-level audio helper (not inside the hook — avoids closure churn)
// ---------------------------------------------------------------------------

function _playCombatSounds(state: TacticalState, refs: AudioTrackingRefs): void {
  const sfx = refs.sfx.current;
  if (!sfx) return;

  // ── New beam effects -> beam sounds (max 3 per tick) ────────────────────
  const currentBeamKeys = new Set<string>();
  for (const beam of state.beamEffects) {
    currentBeamKeys.add(`${beam.sourceShipId}\u2192${beam.targetShipId}`);
  }
  let beamSoundsPlayed = 0;
  for (const beam of state.beamEffects) {
    if (beamSoundsPlayed >= 3) break;
    const key = `${beam.sourceShipId}\u2192${beam.targetShipId}`;
    if (refs.prevBeamKeys.current.has(key)) continue; // not a new beam

    const style: BeamStyle = BEAM_STYLE_MAP[beam.componentId ?? ''] ?? 'pulse';
    switch (style) {
      case 'pulse':      sfx.playBeamPulse(); break;
      case 'particle':
      case 'radiation':  sfx.playBeamParticle(); break;
      case 'disruptor':  sfx.playBeamDisruptor(); break;
      case 'plasma':     sfx.playBeamPlasma(); break;
      case 'spinal':     sfx.playBeamPulse(); break;
    }
    beamSoundsPlayed++;
  }
  refs.prevBeamKeys.current = currentBeamKeys;

  // ── New projectiles -> projectile sounds (max 2 per tick) ───────────────
  const newProjectiles = state.projectiles.length - refs.prevProjectileCount.current;
  if (newProjectiles > 0) {
    const projsToPlay = Math.min(newProjectiles, 2);
    const recent = state.projectiles.slice(-newProjectiles);
    for (let i = 0; i < projsToPlay && i < recent.length; i++) {
      const proj = recent[i]!;
      const pStyle = PROJECTILE_STYLE_MAP[proj.componentId ?? ''] ?? 'kinetic';
      switch (pStyle) {
        case 'kinetic':
        case 'fusion':
        case 'battering_ram':  sfx.playProjectileKinetic(); break;
        case 'gauss':
        case 'antimatter':
        case 'singularity':    sfx.playProjectileGauss(); break;
        case 'mass_driver':    sfx.playProjectileMassDriver(); break;
      }
    }
  }
  refs.prevProjectileCount.current = state.projectiles.length;

  // ── New missiles -> per-type launch sounds (max 2 per tick) ─────────────
  const currentMissileIds = new Set<string>();
  for (const m of (state.missiles ?? [])) {
    currentMissileIds.add(m.id);
  }

  const newMissileCount = state.missiles.length - refs.prevMissileCount.current;
  if (newMissileCount > 0) {
    const recentMissiles = state.missiles.slice(-newMissileCount);
    const launchCount = Math.min(newMissileCount, 2);
    for (let i = 0; i < launchCount && i < recentMissiles.length; i++) {
      const m = recentMissiles[i]!;
      const mStyle: MissileStyle = MISSILE_STYLE_MAP[m.componentId ?? ''] ?? 'torpedo';
      switch (mStyle) {
        case 'basic':       sfx.playMissileLaunchRapid(); break;
        case 'torpedo':
        case 'guided':      sfx.playMissileLaunch(); break;
        case 'fusion':      sfx.playMissileLaunchHeavy(); break;
        case 'antimatter':  sfx.playMissileLaunchHeavy(); break;
        case 'singularity': sfx.playMissileLaunchSingularity(); break;
      }
    }
  }

  // ── Missile impacts — missiles that vanished since last tick ─────────────
  let impactCount = 0;
  for (const prevId of refs.prevMissileIds.current) {
    if (impactCount >= 2) break;
    if (!currentMissileIds.has(prevId)) {
      impactCount++;
    }
  }
  if (impactCount > 0) {
    sfx.playMissileImpact();
  }

  refs.prevMissileCount.current = state.missiles.length;
  refs.prevMissileIds.current = currentMissileIds;

  // ── Point defence effects -> PD burst (max 2 per tick) ──────────────────
  const pdEffects = state.pointDefenceEffects ?? [];
  const newPd = pdEffects.filter(pd => pd.ticksRemaining === 2); // freshly created
  if (newPd.length > 0) {
    const pdCount = Math.min(newPd.length, 2);
    for (let i = 0; i < pdCount; i++) {
      sfx.playPointDefence();
    }
  }

  // ── Fighters -> occasional buzz (max 1 per tick, every 10th tick) ───────
  const fighters = state.fighters ?? [];
  if (fighters.length > 0 && state.tick % 10 === 0) {
    sfx.playFighterBuzz();
  }

  // ── Shield hits -> shield sound (max 2 per tick) ────────────────────────
  let shieldHits = 0;
  for (const ship of state.ships) {
    if (shieldHits >= 2) break;
    if (ship.maxShields <= 0) continue;
    const prev = refs.prevShields.current.get(ship.id) ?? ship.shields;
    if (ship.shields < prev) {
      sfx.playShieldHit();
      shieldHits++;
    }
  }

  // ── Destroyed ships -> explosion ────────────────────────────────────────
  for (const ship of state.ships) {
    if (ship.destroyed && !refs.prevDestroyed.current.has(ship.id)) {
      sfx.playCombatExplosion();
      break; // only one explosion sound per tick to avoid cacophony
    }
  }

  // Update shield tracking for next tick
  for (const ship of state.ships) {
    refs.prevShields.current.set(ship.id, ship.shields);
  }
}

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UseCombatStateReturn {
  // State
  state: TacticalState;
  sceneData: CombatSceneData;
  playerSide: 'attacker' | 'defender';
  paused: boolean;
  battleEnded: boolean;
  speedIndex: number;
  selectedShipIds: string[];
  attackMoveMode: boolean;
  dragBox: { x1: number; y1: number; x2: number; y2: number } | null;
  newlyDestroyed: Set<string>;
  damagedShipIds: Set<string>;
  shieldHitShipIds: Set<string>;

  // Actions
  startBattle: (formation?: FormationType, stance?: CombatStance) => void;
  issueOrder: (order: ShipOrder) => void;
  setStance: (stance: CombatStance) => void;
  setFormation: (formation: FormationType) => void;
  togglePause: () => void;
  setSpeed: (index: number) => void;
  selectShip: (id: string | null) => void;
  selectShips: (ids: string[]) => void;
  retreatAll: () => void;
  admiralRally: () => void;
  admiralRepair: () => void;
  toggleAttackMove: () => void;
  attackMove: (x: number, y: number) => void;
  setDragBox: (box: { x1: number; y1: number; x2: number; y2: number } | null) => void;
  isPlayerShip: (ship: TacticalShip) => boolean;
  cleanup: () => void;
}

// ---------------------------------------------------------------------------
// useCombatState
// ---------------------------------------------------------------------------

/** Convenience alias used by 3D renderer components. */
export type CombatStateAPI = UseCombatStateReturn;

export function useCombatState(data: CombatSceneData): UseCombatStateReturn {
  // ── Derive player side (stable for the battle's lifetime) ───────────────
  const playerSide: 'attacker' | 'defender' =
    data.attackerFleet.empireId === data.playerEmpireId ? 'attacker' : 'defender';

  // ── Initialise tactical state once ──────────────────────────────────────
  const [tacticalState, setTacticalState] = useState<TacticalState>(() =>
    initializeTacticalCombat(
      data.attackerFleet,
      data.defenderFleet,
      data.attackerShips,
      data.defenderShips,
      data.designs,
      data.components,
      data.layout ?? 'open_space',
      data.planetData,
      data.battlefieldSize ?? 'small',
    ),
  );

  // ── React state that triggers re-renders ────────────────────────────────
  const [paused, setPaused] = useState(true); // starts paused for instructions overlay
  const [battleEnded, setBattleEnded] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [selectedShipIds, setSelectedShipIds] = useState<string[]>([]);
  const [attackMoveMode, setAttackMoveMode] = useState(false);
  const [dragBox, setDragBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [newlyDestroyed, setNewlyDestroyed] = useState<Set<string>>(() => new Set());
  const [damagedShipIds, setDamagedShipIds] = useState<Set<string>>(() => new Set());
  const [shieldHitShipIds, setShieldHitShipIds] = useState<Set<string>>(() => new Set());

  // ── Refs for tracking state that does not trigger re-renders ────────────
  const stateRef = useRef(tacticalState);
  stateRef.current = tacticalState;

  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const battleEndedRef = useRef(battleEnded);
  battleEndedRef.current = battleEnded;

  const speedIndexRef = useRef(speedIndex);
  speedIndexRef.current = speedIndex;

  const selectedShipIdsRef = useRef(selectedShipIds);
  selectedShipIdsRef.current = selectedShipIds;

  const prevHull = useRef(new Map<string, number>());
  const prevShields = useRef(new Map<string, number>());
  const prevDestroyed = useRef(new Set<string>());
  const prevBeamKeys = useRef(new Set<string>());
  const prevProjectileCount = useRef(0);
  const prevMissileCount = useRef(0);
  const prevMissileIds = useRef(new Set<string>());

  // Audio
  const sfxRef = useRef<SfxGenerator | null>(null);
  const musicRef = useRef<MusicGenerator | null>(null);
  const preCombatTrackRef = useRef<MusicTrack | null>(null);

  // Tick timer handle
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Initialise hull/shield tracking on first render ─────────────────────
  useEffect(() => {
    const s = stateRef.current;
    for (const ship of s.ships) {
      prevHull.current.set(ship.id, ship.hull);
      prevShields.current.set(ship.id, ship.shields);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Audio initialisation ────────────────────────────────────────────────
  useEffect(() => {
    const audioEngine = getAudioEngine();
    if (audioEngine) {
      sfxRef.current = new SfxGenerator(audioEngine);

      if (!musicRef.current) {
        musicRef.current = new MusicGenerator(audioEngine);
      }
      const sessionTrack = (window as unknown as Record<string, unknown>).__EX_NIHILO_MUSIC_TRACK__ as MusicTrack | undefined;
      preCombatTrackRef.current = sessionTrack ?? 'deep_space';

      // Randomly pick between the two battle tracks
      const battleTrack: MusicTrack = Math.random() < 0.5 ? 'battle_intense' : 'battle_epic';
      musicRef.current.setTrack(battleTrack);
      musicRef.current.startMusic('system');
    }

    return () => {
      // Restore pre-combat music on unmount
      if (musicRef.current) {
        musicRef.current.stopMusic();
        if (preCombatTrackRef.current) {
          (window as unknown as Record<string, unknown>).__EX_NIHILO_MUSIC_TRACK__ = preCombatTrackRef.current;
        }
        musicRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helper: is this ship on the player's side? ──────────────────────────
  const isPlayerShip = useCallback(
    (ship: TacticalShip): boolean => {
      return ship.side === playerSide;
    },
    [playerSide],
  );

  // ── Audio tracking bundle (passed to module-level helper) ───────────────
  const audioRefs: AudioTrackingRefs = {
    prevBeamKeys,
    prevProjectileCount,
    prevMissileCount,
    prevMissileIds,
    prevShields,
    prevDestroyed,
    sfx: sfxRef,
  };

  // ── Tick handler (called by setInterval) ────────────────────────────────
  const onTick = useCallback(() => {
    if (battleEndedRef.current) return;
    if (pausedRef.current) return;

    setTacticalState((prev) => {
      const next = processTacticalTick(prev);

      // -- Trigger audio for this tick --
      _playCombatSounds(next, audioRefs);

      // -- Detect hull damage and shield hits for flash FX --
      const damaged = new Set<string>();
      const destroyed = new Set<string>();
      const shieldHit = new Set<string>();
      for (const ship of next.ships) {
        const oldHull = prevHull.current.get(ship.id) ?? ship.hull;
        if (ship.hull < oldHull) {
          damaged.add(ship.id);
        }
        if (ship.destroyed && !prevDestroyed.current.has(ship.id)) {
          destroyed.add(ship.id);
          prevDestroyed.current.add(ship.id);
        }
        // Shield hit detection
        if (ship.maxShields > 0) {
          const oldShields = prevShields.current.get(ship.id) ?? ship.shields;
          if (ship.shields < oldShields) {
            shieldHit.add(ship.id);
          }
        }
        prevHull.current.set(ship.id, ship.hull);
      }

      // Batch FX state updates (will trigger a single re-render)
      if (damaged.size > 0) setDamagedShipIds(damaged);
      else setDamagedShipIds(new Set());
      if (shieldHit.size > 0) setShieldHitShipIds(shieldHit);
      else setShieldHitShipIds(new Set());
      if (destroyed.size > 0) setNewlyDestroyed(destroyed);
      else setNewlyDestroyed(new Set());

      // -- Check for battle end --
      if (next.outcome !== null) {
        setBattleEnded(true);
        battleEndedRef.current = true;
      }

      return next;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tick loop management ────────────────────────────────────────────────
  useEffect(() => {
    if (paused || battleEnded) {
      // Clear timer when paused or battle ended
      if (tickTimerRef.current !== null) {
        clearInterval(tickTimerRef.current);
        tickTimerRef.current = null;
      }
      return;
    }

    const msPerTick = SPEED_PRESETS[speedIndex]?.msPerTick ?? 100;
    tickTimerRef.current = setInterval(onTick, msPerTick);

    return () => {
      if (tickTimerRef.current !== null) {
        clearInterval(tickTimerRef.current);
        tickTimerRef.current = null;
      }
    };
  }, [paused, battleEnded, speedIndex, onTick]);

  // ── Actions ─────────────────────────────────────────────────────────────

  const startBattle = useCallback(
    (formation?: FormationType, stance?: CombatStance) => {
      setTacticalState((prev) => {
        let next = prev;
        if (formation) {
          next = setFormation(next, playerSide, formation);
        }
        if (stance) {
          next = setShipStance(next, playerSide, stance);
        }
        return next;
      });
      setPaused(false);
    },
    [playerSide],
  );

  const issueOrder = useCallback(
    (order: ShipOrder) => {
      setTacticalState((prev) => {
        const ids = selectedShipIdsRef.current;

        // Multi-ship selection
        if (ids.length > 1) {
          let next = prev;
          if (order.type === 'move') {
            // Use formation offsets so ships advance in formation shape
            const selectedShips = ids
              .map(id => next.ships.find(s => s.id === id))
              .filter((s): s is TacticalShip => !!s && !s.destroyed && !s.routed);

            if (selectedShips.length > 0) {
              const formation = playerSide === 'attacker'
                ? next.attackerFormation
                : next.defenderFormation;
              const positions = getFormationPositions(formation, selectedShips.length);

              for (let i = 0; i < selectedShips.length; i++) {
                const pos = positions[i] ?? { offsetX: 0, offsetY: 0 };
                next = setShipOrder(next, selectedShips[i].id, {
                  type: 'move',
                  x: order.x! + pos.offsetX,
                  y: order.y! + pos.offsetY,
                });
              }
            }
          } else {
            // Attack / flee / idle — same order for all
            for (const id of ids) {
              next = setShipOrder(next, id, order);
            }
          }
          return next;
        }

        // Single ship selection
        if (ids.length === 1) {
          return setShipOrder(prev, ids[0], order);
        }

        return prev;
      });
    },
    [playerSide],
  );

  const setStanceAction = useCallback(
    (stance: CombatStance) => {
      setTacticalState((prev) => {
        let next = prev;
        const ids = selectedShipIdsRef.current;

        // Apply stance to selected ships, or all player ships if none selected
        if (ids.length > 0) {
          for (const id of ids) {
            next = setShipStance(next, id, stance);
          }
        } else {
          next = setShipStance(next, playerSide, stance);
        }

        // Flee stance issues flee orders; all other stances reset orders to idle
        if (stance === 'flee') {
          if (ids.length > 0) {
            for (const id of ids) {
              const ship = next.ships.find(s => s.id === id);
              if (ship && !ship.destroyed && !ship.routed) {
                next = setShipOrder(next, id, { type: 'flee' });
              }
            }
          } else {
            for (const ship of next.ships) {
              if (!ship.destroyed && !ship.routed && ship.side === playerSide) {
                next = setShipOrder(next, ship.id, { type: 'flee' });
              }
            }
          }
        } else {
          // Reset orders to idle so new stance behaviour takes over
          if (ids.length > 0) {
            for (const id of ids) {
              next = setShipOrder(next, id, { type: 'idle' });
            }
          } else {
            for (const ship of next.ships) {
              if (!ship.destroyed && !ship.routed && ship.side === playerSide) {
                next = setShipOrder(next, ship.id, { type: 'idle' });
              }
            }
          }
        }

        return next;
      });
    },
    [playerSide],
  );

  const setFormationAction = useCallback(
    (formation: FormationType) => {
      setTacticalState((prev) => {
        const ids = selectedShipIdsRef.current;
        if (ids.length > 0) {
          return setFormation(prev, playerSide, formation, ids);
        }
        return setFormation(prev, playerSide, formation);
      });
    },
    [playerSide],
  );

  const togglePause = useCallback(() => {
    if (!pausedRef.current) {
      // Pausing — check if admiral has pauses remaining
      const s = stateRef.current;
      const admiral = s.admirals.find(a => a.side === playerSide);
      if (admiral) {
        const result = admiralPause(s, playerSide);
        if (!result) return; // no pauses remaining — cannot pause
        setTacticalState(result);
      }
    }
    setPaused(p => !p);
  }, [playerSide]);

  const setSpeedAction = useCallback((index: number) => {
    if (index < 0 || index >= SPEED_PRESETS.length) return;
    setSpeedIndex(index);
  }, []);

  const selectShip = useCallback((id: string | null) => {
    setSelectedShipIds(id ? [id] : []);
  }, []);

  const selectShips = useCallback((ids: string[]) => {
    setSelectedShipIds(ids);
  }, []);

  const retreatAll = useCallback(() => {
    setTacticalState((prev) => {
      let next = prev;
      for (const ship of next.ships) {
        if (ship.side === playerSide && !ship.destroyed && !ship.routed) {
          next = setShipStance(next, ship.id, 'flee');
          next = setShipOrder(next, ship.id, { type: 'flee' });
        }
      }
      return next;
    });
  }, [playerSide]);

  const admiralRallyAction = useCallback(() => {
    setTacticalState((prev) => {
      const admiral = prev.admirals.find(a => a.side === playerSide);
      if (!admiral || admiral.rallyUsed) return prev;
      return admiralRally(prev, playerSide);
    });
  }, [playerSide]);

  const admiralRepairAction = useCallback(() => {
    setTacticalState((prev) => {
      const ids = selectedShipIdsRef.current;
      if (ids.length === 0) return prev;
      const shipId = ids[0];
      const admiral = prev.admirals.find(a => a.side === playerSide);
      if (!admiral || admiral.emergencyRepairUsed) return prev;
      return admiralEmergencyRepair(prev, playerSide, shipId);
    });
  }, [playerSide]);

  const toggleAttackMove = useCallback(() => {
    setAttackMoveMode(m => !m);
  }, []);

  const attackMoveAction = useCallback(
    (x: number, y: number) => {
      // Set at_ease stance on selected ships, then issue move order
      setTacticalState((prev) => {
        let next = prev;
        const ids = selectedShipIdsRef.current;

        if (ids.length > 0) {
          for (const id of ids) {
            next = setShipStance(next, id, 'at_ease');
          }
        }

        // Issue move order with formation offsets for multi-ship
        if (ids.length > 1) {
          const selectedShips = ids
            .map(id => next.ships.find(s => s.id === id))
            .filter((s): s is TacticalShip => !!s && !s.destroyed && !s.routed);

          if (selectedShips.length > 0) {
            const formation = playerSide === 'attacker'
              ? next.attackerFormation
              : next.defenderFormation;
            const positions = getFormationPositions(formation, selectedShips.length);

            for (let i = 0; i < selectedShips.length; i++) {
              const pos = positions[i] ?? { offsetX: 0, offsetY: 0 };
              next = setShipOrder(next, selectedShips[i].id, {
                type: 'move',
                x: x + pos.offsetX,
                y: y + pos.offsetY,
              });
            }
          }
        } else if (ids.length === 1) {
          next = setShipOrder(next, ids[0], { type: 'move', x, y });
        }

        return next;
      });
      setAttackMoveMode(false);
    },
    [playerSide],
  );

  const cleanup = useCallback(() => {
    if (tickTimerRef.current !== null) {
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
    if (musicRef.current) {
      musicRef.current.stopMusic();
      if (preCombatTrackRef.current) {
        (window as unknown as Record<string, unknown>).__EX_NIHILO_MUSIC_TRACK__ = preCombatTrackRef.current;
      }
      musicRef.current = null;
    }
  }, []);

  // ── Cleanup on unmount ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (tickTimerRef.current !== null) {
        clearInterval(tickTimerRef.current);
        tickTimerRef.current = null;
      }
    };
  }, []);

  // ── Return ──────────────────────────────────────────────────────────────
  return {
    // State
    state: tacticalState,
    sceneData: data,
    playerSide,
    paused,
    battleEnded,
    speedIndex,
    selectedShipIds,
    attackMoveMode,
    dragBox,
    newlyDestroyed,
    damagedShipIds,
    shieldHitShipIds,

    // Actions
    startBattle,
    issueOrder,
    setStance: setStanceAction,
    setFormation: setFormationAction,
    togglePause,
    setSpeed: setSpeedAction,
    selectShip,
    selectShips,
    retreatAll,
    admiralRally: admiralRallyAction,
    admiralRepair: admiralRepairAction,
    toggleAttackMove,
    attackMove: attackMoveAction,
    setDragBox,
    isPlayerShip,
    cleanup,
  };
}
