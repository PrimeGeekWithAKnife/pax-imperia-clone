/**
 * CombatHUD — Pure React HTML overlay rendered OUTSIDE the R3F Canvas.
 *
 * Absolutely positioned over the 3D viewport. All state comes from
 * CombatStateAPI (the return value of useCombatState).
 *
 * Sections:
 *  - Top-left:     Title, tick counter, empire names, admiral info
 *  - Top-right:    Speed buttons + pause
 *  - Bottom bar:   Formation + stance buttons
 *  - Bottom-right: Admiral commands + retreat all
 *  - Bottom-left:  Selected ship info
 *  - Centre-top:   Attack-move indicator (conditional)
 *  - Drag-box:     Selection rectangle (conditional)
 */

import React from 'react';
import type { CombatStateAPI } from './useCombatState';
import type { FormationType, CombatStance } from '@nova-imperia/shared';
import { SPEED_PRESETS } from './constants';

// ---------------------------------------------------------------------------
// Formation & stance definitions
// ---------------------------------------------------------------------------

const FORMATIONS: { label: string; type: FormationType }[] = [
  { label: 'LINE', type: 'line' },
  { label: 'SPEAR', type: 'spearhead' },
  { label: 'DIAMOND', type: 'diamond' },
  { label: 'WINGS', type: 'wings' },
];

const STANCES: { label: string; type: CombatStance; desc: string }[] = [
  { label: 'AGGRESSIVE', type: 'aggressive', desc: 'Fire at will, hold position' },
  { label: 'AT EASE', type: 'at_ease', desc: 'Ship captains act independently' },
  { label: 'DEFENSIVE', type: 'defensive', desc: 'Fire only when fired upon' },
  { label: 'EVASIVE', type: 'evasive', desc: 'Maintain distance, fire if opportunity' },
  { label: 'FLEE', type: 'flee', desc: 'Withdraw immediately' },
];

// ---------------------------------------------------------------------------
// Stance highlight colours
// ---------------------------------------------------------------------------

const STANCE_COLOURS: Record<CombatStance, string> = {
  aggressive: '#ff4444',
  at_ease: '#44ffaa',
  defensive: '#4488ff',
  evasive: '#ffaa44',
  flee: '#ff4444',
};

// ---------------------------------------------------------------------------
// Shared inline styles
// ---------------------------------------------------------------------------

const TEXT_BASE: React.CSSProperties = {
  fontFamily: 'monospace',
  color: '#ccddee',
  fontSize: 12,
};

const BTN_BASE: React.CSSProperties = {
  ...TEXT_BASE,
  background: '#1a1a2e',
  border: 'none',
  padding: '4px 10px',
  cursor: 'pointer',
  pointerEvents: 'auto',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CombatHUDProps {
  api: CombatStateAPI;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CombatHUD: React.FC<CombatHUDProps> = ({ api }) => {
  const {
    state,
    sceneData,
    playerSide,
    paused,
    speedIndex,
    selectedShipIds,
    attackMoveMode,
    dragBox,
  } = api;

  // Derive active formation for the player's side
  const activeFormation: FormationType =
    playerSide === 'attacker' ? state.attackerFormation : state.defenderFormation;

  // Admiral for the player's side
  const admiral = state.admirals.find(a => a.side === playerSide);

  // Determine effective stance — use first selected ship's stance, else null
  const selectedShips = selectedShipIds
    .map(id => state.ships.find(s => s.id === id))
    .filter((s): s is NonNullable<typeof s> => s != null && !s.destroyed);
  const activeStance: CombatStance | null = selectedShips.length > 0
    ? selectedShips[0].stance
    : null;

  // Battlefield dimensions for drag-box coordinate conversion
  const bfW = state.battlefieldWidth;
  const bfH = state.battlefieldHeight;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        fontFamily: 'monospace',
        color: '#ccddee',
        fontSize: 12,
        overflow: 'hidden',
      }}
    >
      {/* ── Top-left: title, tick, empires, admiral ────────────── */}
      <div style={{ position: 'absolute', top: 10, left: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 'bold', letterSpacing: 2 }}>
          TACTICAL COMBAT
        </div>
        <div style={{ marginTop: 4, opacity: 0.7 }}>
          Tick {state.tick}
        </div>
        <div style={{ marginTop: 6, display: 'flex', gap: 12 }}>
          <span style={{ color: sceneData.attackerColor }}>
            {sceneData.attackerName}
          </span>
          <span style={{ opacity: 0.4 }}>vs</span>
          <span style={{ color: sceneData.defenderColor }}>
            {sceneData.defenderName}
          </span>
        </div>
        {admiral && (
          <div style={{ marginTop: 6, opacity: 0.85 }}>
            <div>Admiral {admiral.name}</div>
            <div style={{ opacity: 0.6 }}>
              Pauses: {admiral.pausesRemaining} | Trait: {admiral.trait}
            </div>
          </div>
        )}
      </div>

      {/* ── Top-right: speed + pause ───────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 12,
          display: 'flex',
          gap: 4,
        }}
      >
        {SPEED_PRESETS.map((preset, idx) => (
          <button
            key={preset.label}
            style={{
              ...BTN_BASE,
              color: speedIndex === idx ? '#44ffaa' : '#ccddee',
              borderBottom: speedIndex === idx ? '2px solid #44ffaa' : '2px solid transparent',
            }}
            onClick={() => api.setSpeed(idx)}
          >
            {preset.label}
          </button>
        ))}
        <button
          style={{
            ...BTN_BASE,
            color: paused ? '#ff4444' : '#ccddee',
            marginLeft: 6,
          }}
          onClick={() => api.togglePause()}
        >
          {paused ? '||' : '>'}
        </button>
      </div>

      {/* ── Centre-top: attack-move indicator ──────────────────── */}
      {attackMoveMode && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255,68,68,0.25)',
            border: '1px solid #ff4444',
            borderRadius: 4,
            padding: '4px 14px',
            fontSize: 13,
            fontWeight: 'bold',
            color: '#ff6666',
          }}
        >
          ATTACK-MOVE
        </div>
      )}

      {/* ── Bottom-left (above bar): selected ship info ────────── */}
      <div style={{ position: 'absolute', bottom: 56, left: 12 }}>
        {selectedShips.length === 1 && (() => {
          const ship = selectedShips[0];
          const hullPct = ship.maxHull > 0
            ? Math.round((ship.hull / ship.maxHull) * 100)
            : 0;
          const shieldPct = ship.maxShields > 0
            ? Math.round((ship.shields / ship.maxShields) * 100)
            : 0;
          return (
            <div
              style={{
                background: 'rgba(10,22,40,0.85)',
                borderRadius: 4,
                padding: '6px 10px',
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: 2 }}>{ship.name}</div>
              <div>Hull: {hullPct}%  Shields: {shieldPct}%</div>
              <div>Morale: {ship.crew.morale}  XP: {ship.crew.experience}</div>
              <div style={{ opacity: 0.6 }}>Order: {ship.order.type}</div>
            </div>
          );
        })()}
        {selectedShips.length > 1 && (
          <div
            style={{
              background: 'rgba(10,22,40,0.85)',
              borderRadius: 4,
              padding: '6px 10px',
              fontWeight: 'bold',
            }}
          >
            ALL SHIPS SELECTED ({selectedShips.length})
          </div>
        )}
      </div>

      {/* ── Bottom-right (above bar): admiral commands ─────────── */}
      <div
        style={{
          position: 'absolute',
          bottom: 56,
          right: 12,
          display: 'flex',
          gap: 4,
        }}
      >
        {admiral && (
          <>
            <button
              style={{
                ...BTN_BASE,
                opacity: admiral.rallyUsed ? 0.35 : 1,
              }}
              disabled={admiral.rallyUsed}
              onClick={() => api.admiralRally()}
            >
              RALLY
            </button>
            <button
              style={{
                ...BTN_BASE,
                opacity: admiral.emergencyRepairUsed ? 0.35 : 1,
              }}
              disabled={admiral.emergencyRepairUsed}
              onClick={() => api.admiralRepair()}
            >
              REPAIR
            </button>
          </>
        )}
        <button
          style={{
            ...BTN_BASE,
            border: '1px solid #ff4444',
            color: '#ff4444',
            marginLeft: 6,
          }}
          onClick={() => api.retreatAll()}
        >
          RETREAT ALL
        </button>
      </div>

      {/* ── Bottom bar: formations + stances ───────────────────── */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(10,22,40,0.85)',
          borderRadius: 6,
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {/* Formation buttons */}
        <span style={{ opacity: 0.5, marginRight: 2 }}>FMT:</span>
        {FORMATIONS.map(f => (
          <button
            key={f.type}
            style={{
              ...BTN_BASE,
              color: activeFormation === f.type ? '#44ffaa' : '#ccddee',
              borderBottom:
                activeFormation === f.type
                  ? '2px solid #44ffaa'
                  : '2px solid transparent',
            }}
            onClick={() => api.setFormation(f.type)}
          >
            {f.label}
          </button>
        ))}

        {/* Separator */}
        <span
          style={{
            display: 'inline-block',
            width: 1,
            height: 18,
            background: '#334455',
            margin: '0 6px',
          }}
        />

        {/* Stance buttons */}
        <span style={{ opacity: 0.5, marginRight: 2 }}>STANCE:</span>
        {STANCES.map(s => {
          const isActive = activeStance === s.type;
          const highlight = isActive ? STANCE_COLOURS[s.type] : '#ccddee';
          return (
            <button
              key={s.type}
              style={{
                ...BTN_BASE,
                color: highlight,
                borderBottom: isActive
                  ? `2px solid ${highlight}`
                  : '2px solid transparent',
              }}
              title={s.desc}
              onClick={() => api.setStance(s.type)}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* ── Drag-box overlay ───────────────────────────────────── */}
      {dragBox && (() => {
        // Convert tactical coordinates to screen percentages
        const left = Math.min(dragBox.x1, dragBox.x2) / bfW * 100;
        const top = Math.min(dragBox.y1, dragBox.y2) / bfH * 100;
        const width = Math.abs(dragBox.x2 - dragBox.x1) / bfW * 100;
        const height = Math.abs(dragBox.y2 - dragBox.y1) / bfH * 100;
        return (
          <div
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: `${top}%`,
              width: `${width}%`,
              height: `${height}%`,
              border: '1px solid rgba(68,255,170,0.6)',
              background: 'rgba(68,255,170,0.08)',
              pointerEvents: 'none',
            }}
          />
        );
      })()}
    </div>
  );
};

export default CombatHUD;
