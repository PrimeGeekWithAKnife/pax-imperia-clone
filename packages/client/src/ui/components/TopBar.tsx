import React, { useCallback, useRef, useEffect } from 'react';
import type { GameSpeedName, GovernmentType } from '@nova-imperia/shared';
import { STARTING_CREDITS, STARTING_RESEARCH_POINTS, GOVERNMENTS } from '@nova-imperia/shared';

/** Compact number formatter: 1000 → 1K, 1000000 → 1M, 1000000000 → 1B */
function compact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${Math.floor(abs)}`;
}

interface TopBarProps {
  gameSpeed: GameSpeedName;
  onSpeedChange: (speed: GameSpeedName) => void;
  credits?: number;
  researchPoints?: number;
  onOpenResearch?: () => void;
  onOpenShipDesigner?: () => void;
  onOpenDiplomacy?: () => void;
  onOpenFleet?: () => void;
  onOpenEconomy?: () => void;
  onOpenColonyList?: () => void;
  onOpenEspionage?: () => void;
  minerals?: number;
  energy?: number;
  organics?: number;
  /** Government type for the player's empire, shown as a badge. */
  government?: GovernmentType;
  /** Empire name for display. */
  empireName?: string;
  /** Current game tick, displayed as "Turn N". */
  currentTick?: number;
}

interface SpeedButton {
  name: GameSpeedName;
  icon: string;
  label: string;
}

const SPEED_BUTTONS: SpeedButton[] = [
  { name: 'paused', icon: '⏸', label: 'Pause' },
  { name: 'slow', icon: '▶', label: 'Slow' },
  { name: 'normal', icon: '▶▶', label: 'Normal' },
  { name: 'fast', icon: '▶▶▶', label: 'Fast' },
  { name: 'fastest', icon: '▶▶▶▶', label: 'Fastest' },
];

export function TopBar({
  gameSpeed,
  onSpeedChange,
  credits = STARTING_CREDITS,
  researchPoints = STARTING_RESEARCH_POINTS,
  onOpenResearch,
  onOpenShipDesigner,
  onOpenDiplomacy,
  onOpenFleet,
  onOpenEconomy,
  onOpenColonyList,
  onOpenEspionage,
  minerals = 0,
  energy = 0,
  organics = 0,
  government,
  empireName,
  currentTick,
}: TopBarProps): React.ReactElement {
  const prevRef = useRef({ credits, minerals, energy, organics, researchPoints });
  const deltaRef = useRef({ credits: 0, minerals: 0, energy: 0, organics: 0, researchPoints: 0 });

  useEffect(() => {
    const prev = prevRef.current;
    deltaRef.current = {
      credits: credits - prev.credits,
      minerals: minerals - prev.minerals,
      energy: energy - prev.energy,
      organics: organics - prev.organics,
      researchPoints: researchPoints - prev.researchPoints,
    };
    prevRef.current = { credits, minerals, energy, organics, researchPoints };
  }, [credits, minerals, energy, organics, researchPoints]);

  const delta = deltaRef.current;

  const govName = government ? (GOVERNMENTS[government]?.name ?? government) : null;
  const handleSpeedClick = useCallback(
    (speed: GameSpeedName) => {
      onSpeedChange(speed);
    },
    [onSpeedChange],
  );

  return (
    <div className="top-bar">
      {/* Title + empire info */}
      <div className="top-bar__title">
        {empireName ? empireName : 'EX NIHILO'}
      </div>
      {govName && (
        <div className="top-bar__gov-badge" title={`Government: ${govName}`}>
          {govName}
        </div>
      )}
      {currentTick !== undefined && (
        <div className="top-bar__turn" title="Current game turn">
          Turn {currentTick}
        </div>
      )}

      {/* Speed controls */}
      <div className="top-bar__speed-controls" role="group" aria-label="Game speed">
        {SPEED_BUTTONS.map((btn) => (
          <button
            key={btn.name}
            className={`speed-btn${gameSpeed === btn.name ? ' speed-btn--active' : ''}`}
            onClick={() => handleSpeedClick(btn.name)}
            title={btn.label}
            aria-pressed={gameSpeed === btn.name}
          >
            {btn.icon}
          </button>
        ))}
        <span className="speed-label">{gameSpeed.toUpperCase()}</span>
      </div>

      {/* Action buttons */}
      <div className="top-bar__actions" style={{ display: 'flex', gap: '4px', pointerEvents: 'auto' }}>
        {onOpenResearch && (
          <button className="speed-btn" onClick={onOpenResearch} title="Research (R)">⚗ Research</button>
        )}
        {onOpenShipDesigner && (
          <button className="speed-btn" onClick={onOpenShipDesigner} title="Ship Designer (S)">⚙ Ships</button>
        )}
        <button className="speed-btn" onClick={onOpenFleet} title="Fleet Overview (F)">⚓ Fleet</button>
        <button className="speed-btn" onClick={onOpenEconomy} title="Economy Overview (E)">₵ Economy</button>
        {onOpenColonyList && (
          <button className="speed-btn" onClick={onOpenColonyList} title="Colony List (C)">🏛 Colonies</button>
        )}
        <button className="speed-btn" onClick={onOpenEspionage} title="Espionage (F5)">🕵 Espionage</button>
        {onOpenDiplomacy && (
          <button className="speed-btn" onClick={onOpenDiplomacy} title="Diplomacy (D)">☮ Diplomacy</button>
        )}
      </div>

      {/* Resources */}
      <div className="top-bar__resources">
        <span className="resource-item" title="Credits">
          <span className="resource-icon">₵</span>
          <span className="resource-value">{compact(credits)}</span>
          {delta.credits !== 0 && (
            <span className="resource-rate" style={{ color: delta.credits > 0 ? '#44cc88' : '#ff4444', fontSize: '10px', marginLeft: '2px' }}>
              {delta.credits > 0 ? '+' : ''}{compact(delta.credits)}
            </span>
          )}
        </span>
        <span className="resource-item" title="Minerals">
          <span className="resource-icon">⛏</span>
          <span className="resource-value">{compact(minerals)}</span>
          {delta.minerals !== 0 && (
            <span className="resource-rate" style={{ color: delta.minerals > 0 ? '#44cc88' : '#ff4444', fontSize: '10px', marginLeft: '2px' }}>
              {delta.minerals > 0 ? '+' : ''}{compact(delta.minerals)}
            </span>
          )}
        </span>
        <span className="resource-item" title="Energy">
          <span className="resource-icon" style={{ color: energy < 0 ? '#ff4444' : undefined }}>⚡</span>
          <span className="resource-value" style={{ color: energy < 0 ? '#ff4444' : undefined }}>{compact(energy)}</span>
          {delta.energy !== 0 && (
            <span className="resource-rate" style={{ color: delta.energy > 0 ? '#44cc88' : '#ff4444', fontSize: '10px', marginLeft: '2px' }}>
              {delta.energy > 0 ? '+' : ''}{compact(delta.energy)}
            </span>
          )}
        </span>
        <span className="resource-item" title="Organics (Food)">
          <span className="resource-icon" style={{ color: organics < 0 ? '#ff4444' : undefined }}>🌾</span>
          <span className="resource-value" style={{ color: organics < 0 ? '#ff4444' : undefined }}>{compact(organics)}</span>
          {delta.organics !== 0 && (
            <span className="resource-rate" style={{ color: delta.organics > 0 ? '#44cc88' : '#ff4444', fontSize: '10px', marginLeft: '2px' }}>
              {delta.organics > 0 ? '+' : ''}{compact(delta.organics)}
            </span>
          )}
        </span>
        <span className="resource-item" title="Research">
          <span className="resource-icon">⚗</span>
          <span className="resource-value">{compact(researchPoints)}</span>
          {delta.researchPoints !== 0 && (
            <span className="resource-rate" style={{ color: delta.researchPoints > 0 ? '#44cc88' : '#ff4444', fontSize: '10px', marginLeft: '2px' }}>
              {delta.researchPoints > 0 ? '+' : ''}{compact(delta.researchPoints)}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
