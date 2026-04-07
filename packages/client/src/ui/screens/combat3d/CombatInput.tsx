/**
 * CombatInput — invisible R3F component that handles all 3D combat input.
 *
 * Registers event listeners on the WebGL canvas (mouse) and window (keyboard).
 * Converts screen coordinates to tactical coordinates via raycasting against a
 * ground plane at y=0.  Renders nothing.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { CombatStateAPI } from './useCombatState';
import { BF_SCALE } from './constants';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Proximity radius (in tactical units) for click-to-select / click-to-attack. */
const CLICK_RADIUS = 30;

/** Minimum pixel drag distance before treating as a box-select rather than a click. */
const DRAG_THRESHOLD = 10;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CombatInputProps {
  api: CombatStateAPI;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CombatInput({ api }: CombatInputProps): null {
  const { camera, gl } = useThree();

  // Stable refs so event handlers always see the latest API state without
  // needing to re-register listeners on every render.
  const apiRef = useRef(api);
  apiRef.current = api;

  // Raycasting helpers (allocated once, reused every call)
  const raycasterRef = useRef(new THREE.Raycaster());
  const groundPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));

  // Drag-selection tracking
  const dragStartScreen = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);

  // ---------------------------------------------------------------------------
  // Screen -> Tactical coordinate conversion
  // ---------------------------------------------------------------------------

  const screenToTactical = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycasterRef.current.setFromCamera(ndc, camera);
      const intersection = new THREE.Vector3();
      if (!raycasterRef.current.ray.intersectPlane(groundPlaneRef.current, intersection)) {
        return null;
      }
      return {
        x: intersection.x / BF_SCALE + api.state.battlefieldWidth / 2,
        y: intersection.z / BF_SCALE + api.state.battlefieldHeight / 2,
      };
    },
    [camera, gl],
  );

  // ---------------------------------------------------------------------------
  // Ship proximity helpers
  // ---------------------------------------------------------------------------

  const findNearestShip = useCallback(
    (
      tx: number,
      ty: number,
      filterFn: (ship: { destroyed: boolean; routed: boolean; side: string }) => boolean,
    ): string | null => {
      const a = apiRef.current;
      let bestId: string | null = null;
      let bestDist = CLICK_RADIUS;

      for (const ship of a.state.ships) {
        if (ship.destroyed || ship.routed) continue;
        if (!filterFn(ship)) continue;
        const dx = tx - ship.position.x;
        const dy = ty - ship.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist) {
          bestDist = dist;
          bestId = ship.id;
        }
      }
      return bestId;
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Mouse events (registered on gl.domElement)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const canvas = gl.domElement;

    // Prevent browser context menu
    const onContextMenu = (e: Event) => {
      e.preventDefault();
    };

    // ── Right-click ────────────────────────────────────────────────────────
    const onMouseDown = (e: MouseEvent) => {
      const a = apiRef.current;

      // --- Right-click: move / attack / attack-move ---
      if (e.button === 2) {
        if (a.selectedShipIds.length === 0) return;

        const tac = screenToTactical(e.clientX, e.clientY);
        if (!tac) return;

        // Attack-move mode: move with at_ease stance
        if (a.attackMoveMode) {
          a.attackMove(tac.x, tac.y);
          return;
        }

        // Check for enemy ship near click
        const enemyId = findNearestShip(tac.x, tac.y, (s) => !a.isPlayerShip(s as never));
        if (enemyId) {
          a.issueOrder({ type: 'attack', targetId: enemyId });
          return;
        }

        // Empty space — move order
        a.issueOrder({ type: 'move', x: tac.x, y: tac.y });
        return;
      }

      // --- Left-click: begin potential drag-box ---
      if (e.button === 0 && !e.shiftKey) {
        dragStartScreen.current = { x: e.clientX, y: e.clientY };
        isDragging.current = false;
      }
    };

    // ── Left mousemove (drag-box update) ───────────────────────────────────
    const onMouseMove = (e: MouseEvent) => {
      if (!dragStartScreen.current) return;
      if (!(e.buttons & 1)) {
        // Left button no longer held
        dragStartScreen.current = null;
        isDragging.current = false;
        apiRef.current.setDragBox(null);
        return;
      }

      const dx = Math.abs(e.clientX - dragStartScreen.current.x);
      const dy = Math.abs(e.clientY - dragStartScreen.current.y);

      if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
        isDragging.current = true;

        // Convert both corners to tactical coordinates for the drag box
        const start = screenToTactical(dragStartScreen.current.x, dragStartScreen.current.y);
        const end = screenToTactical(e.clientX, e.clientY);
        if (start && end) {
          apiRef.current.setDragBox({
            x1: Math.min(start.x, end.x),
            y1: Math.min(start.y, end.y),
            x2: Math.max(start.x, end.x),
            y2: Math.max(start.y, end.y),
          });
        }
      }
    };

    // ── Left mouseup (finish drag or process click) ────────────────────────
    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;

      const a = apiRef.current;

      if (isDragging.current) {
        // Drag-box select: select all friendly ships within the box
        const start = screenToTactical(dragStartScreen.current!.x, dragStartScreen.current!.y);
        const end = screenToTactical(e.clientX, e.clientY);

        if (start && end) {
          const minX = Math.min(start.x, end.x);
          const maxX = Math.max(start.x, end.x);
          const minY = Math.min(start.y, end.y);
          const maxY = Math.max(start.y, end.y);

          const selected = a.state.ships
            .filter(
              (s) =>
                !s.destroyed &&
                !s.routed &&
                a.isPlayerShip(s) &&
                s.position.x >= minX &&
                s.position.x <= maxX &&
                s.position.y >= minY &&
                s.position.y <= maxY,
            )
            .map((s) => s.id);

          if (selected.length > 0) {
            a.selectShips(selected);
          }
        }

        a.setDragBox(null);
      } else {
        // Small click (no drag) — check what was clicked
        const tac = screenToTactical(e.clientX, e.clientY);
        if (!tac) {
          dragStartScreen.current = null;
          isDragging.current = false;
          return;
        }

        // Friendly ship — select it
        const friendlyId = findNearestShip(tac.x, tac.y, (s) => a.isPlayerShip(s as never));
        if (friendlyId) {
          a.selectShip(friendlyId);
          dragStartScreen.current = null;
          isDragging.current = false;
          return;
        }

        // Enemy ship — attack order (only if we have a selection)
        if (a.selectedShipIds.length > 0) {
          const enemyId = findNearestShip(tac.x, tac.y, (s) => !a.isPlayerShip(s as never));
          if (enemyId) {
            a.issueOrder({ type: 'attack', targetId: enemyId });
            dragStartScreen.current = null;
            isDragging.current = false;
            return;
          }
        }

        // Attack-move mode — click on empty space issues attack-move
        if (a.attackMoveMode && a.selectedShipIds.length > 0) {
          a.attackMove(tac.x, tac.y);
          dragStartScreen.current = null;
          isDragging.current = false;
          return;
        }

        // Empty space with selection — move order
        if (a.selectedShipIds.length > 0) {
          a.issueOrder({ type: 'move', x: tac.x, y: tac.y });
        }
      }

      dragStartScreen.current = null;
      isDragging.current = false;
    };

    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);

    return () => {
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
    };
  }, [gl, screenToTactical, findNearestShip]);

  // ---------------------------------------------------------------------------
  // Keyboard events (registered on window)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const a = apiRef.current;

      // Prevent ALL keyboard events from reaching Phaser/other listeners
      // while combat is active — otherwise Escape triggers scene navigation.
      e.stopPropagation();
      e.stopImmediatePropagation();

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          a.selectShips([]);
          if (a.attackMoveMode) a.toggleAttackMove();
          break;

        case 'h':
        case 'H':
          // Halt — issue idle order to selected ships
          if (a.selectedShipIds.length > 0) {
            a.issueOrder({ type: 'idle' });
          }
          break;

        case 'a':
        case 'A':
          if (e.ctrlKey || e.metaKey) {
            // Ctrl+A — select all friendly ships
            e.preventDefault();
            e.stopImmediatePropagation();
            const friendlyIds = a.state.ships
              .filter((s) => !s.destroyed && !s.routed && a.isPlayerShip(s))
              .map((s) => s.id);
            if (friendlyIds.length > 0) {
              a.selectShips(friendlyIds);
            }
          } else {
            // A alone — toggle attack-move mode (only when ships selected)
            if (a.selectedShipIds.length > 0) {
              a.toggleAttackMove();
            }
          }
          break;
      }
    };

    // Capture phase so Ctrl+A fires before browser "select all"
    window.addEventListener('keydown', onKeyDown, true);

    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, []);

  return null;
}
