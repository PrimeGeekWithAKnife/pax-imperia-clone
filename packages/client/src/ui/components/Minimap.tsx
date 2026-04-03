import React, { useRef, useEffect, useCallback, useState } from 'react';
import type { StarSystem } from '@nova-imperia/shared';
import { useGameEvent } from '../hooks/useGameEvents';

interface MinimapProps {
  systems?: StarSystem[];
  /** Galaxy logical dimensions (used for coordinate mapping) */
  galaxyWidth?: number;
  galaxyHeight?: number;
  /** Current camera viewport in world coordinates */
  viewport?: { x: number; y: number; width: number; height: number } | null;
  /** System IDs the player has discovered. When provided, only known systems are rendered. */
  knownSystems?: string[];
  /** Empire ID → colour hex string for ownership display. */
  empireColorMap?: Map<string, string>;
}

const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 150;

const STAR_TYPE_COLORS: Record<string, string> = {
  blue_giant: '#4488ff',
  white: '#eeeeff',
  yellow: '#ffdd44',
  orange: '#ff8833',
  red_dwarf: '#ff4422',
  red_giant: '#ff2211',
  neutron: '#aaffee',
  binary: '#ffff88',
};

function emitNavigate(normX: number, normY: number): void {
  const game = (window as unknown as Record<string, unknown>).__EX_NIHILO_GAME__ as
    | { events: { emit: (e: string, d: unknown) => void } }
    | undefined;
  game?.events.emit('minimap:navigate', { normX, normY });
}

export function Minimap({
  systems = [],
  galaxyWidth = 1000,
  galaxyHeight = 1000,
  viewport = null,
  knownSystems,
  empireColorMap,
}: MinimapProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);
    ctx.fillStyle = 'rgba(3, 3, 18, 0.95)';
    ctx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // If systems prop is empty, try to get from engine directly
    let effectiveSystems = systems;
    let effectiveWidth = galaxyWidth;
    let effectiveHeight = galaxyHeight;
    if (effectiveSystems.length === 0) {
      try {
        const eng = (window as unknown as Record<string, unknown>).__GAME_ENGINE__ as
          | { getState: () => { gameState: { galaxy: { systems: StarSystem[]; width: number; height: number } } } }
          | undefined;
        const galaxy = eng?.getState()?.gameState?.galaxy;
        if (galaxy && galaxy.systems.length > 0) {
          effectiveSystems = galaxy.systems;
          effectiveWidth = galaxy.width;
          effectiveHeight = galaxy.height;
        }
      } catch { /* ignore */ }
    }

    const toMapX = (wx: number) => (wx / effectiveWidth) * MINIMAP_WIDTH;
    const toMapY = (wy: number) => (wy / effectiveHeight) * MINIMAP_HEIGHT;

    // Filter to known systems when fog of war is active
    const knownSet = knownSystems ? new Set(knownSystems) : null;
    const visibleSystems = knownSet
      ? effectiveSystems.filter((s) => knownSet.has(s.id))
      : effectiveSystems;

    // Draw wormhole connections (only between two known endpoints)
    ctx.strokeStyle = 'rgba(0, 180, 220, 0.18)';
    ctx.lineWidth = 0.8;
    const drawn = new Set<string>();
    for (const sys of visibleSystems) {
      for (const otherId of sys.wormholes) {
        if (knownSet && !knownSet.has(otherId)) continue;
        const key = [sys.id, otherId].sort().join('|');
        if (drawn.has(key)) continue;
        drawn.add(key);
        const other = visibleSystems.find((s) => s.id === otherId);
        if (!other) continue;
        ctx.beginPath();
        ctx.moveTo(toMapX(sys.position.x), toMapY(sys.position.y));
        ctx.lineTo(toMapX(other.position.x), toMapY(other.position.y));
        ctx.stroke();
      }
    }

    // Draw empire ownership rings behind star dots
    if (empireColorMap) {
      for (const sys of visibleSystems) {
        if (!sys.ownerId || !empireColorMap.has(sys.ownerId)) continue;
        const ox = toMapX(sys.position.x);
        const oy = toMapY(sys.position.y);
        const empCol = empireColorMap.get(sys.ownerId)!;
        // Filled circle at low opacity
        ctx.beginPath();
        ctx.arc(ox, oy, 5, 0, Math.PI * 2);
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = empCol;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        // Ring outline
        ctx.beginPath();
        ctx.arc(ox, oy, 5, 0, Math.PI * 2);
        ctx.strokeStyle = empCol;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    // Draw star systems
    for (const sys of visibleSystems) {
      const mx = toMapX(sys.position.x);
      const my = toMapY(sys.position.y);
      const color = STAR_TYPE_COLORS[sys.starType] ?? '#ffffff';

      // Glow
      ctx.beginPath();
      ctx.arc(mx, my, 3, 0, Math.PI * 2);
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Dot
      ctx.beginPath();
      ctx.arc(mx, my, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    // Draw viewport rectangle
    if (viewport) {
      const rx = toMapX(viewport.x);
      const ry = toMapY(viewport.y);
      const rw = toMapX(viewport.width);
      const rh = toMapY(viewport.height);
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(rx, ry, rw, rh);
    }
  }, [systems, galaxyWidth, galaxyHeight, viewport, knownSystems, empireColorMap]);

  // Redraw on prop changes
  useEffect(() => {
    draw();
  }, [draw]);

  // Also redraw every engine tick so newly discovered systems appear
  const [, setTickCount] = useState(0);
  useGameEvent<{ tick: number }>('engine:tick', useCallback(() => {
    setTickCount(c => c + 1);
  }, []));

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const normX = px / MINIMAP_WIDTH;
      const normY = py / MINIMAP_HEIGHT;
      emitNavigate(normX, normY);
    },
    [],
  );

  return (
    <div className="minimap">
      <div className="minimap__label">GALAXY MAP</div>
      <canvas
        ref={canvasRef}
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        className="minimap__canvas"
        onClick={handleClick}
        title="Click to navigate"
      />
    </div>
  );
}
