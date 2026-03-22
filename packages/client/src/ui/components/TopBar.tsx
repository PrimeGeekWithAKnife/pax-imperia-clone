import React, { useCallback } from 'react';
import type { GameSpeedName, GovernmentType } from '@nova-imperia/shared';
import { STARTING_CREDITS, STARTING_RESEARCH_POINTS, GOVERNMENTS } from '@nova-imperia/shared';

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
  onOpenEspionage?: () => void;
  minerals?: number;
  energy?: number;
  organics?: number;
  /** Government type for the player's empire, shown as a badge. */
  government?: GovernmentType;
  /** Empire name for display. */
  empireName?: string;
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
  onOpenEspionage,
  minerals = 0,
  energy = 0,
  organics = 0,
  government,
  empireName,
}: TopBarProps): React.ReactElement {
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
          <button className="speed-btn" onClick={onOpenResearch} title="Research">⚗ Research</button>
        )}
        {onOpenShipDesigner && (
          <button className="speed-btn" onClick={onOpenShipDesigner} title="Ship Designer">⚙ Ships</button>
        )}
        <button className="speed-btn" onClick={onOpenFleet} title="Fleet Overview">⚓ Fleet</button>
        <button className="speed-btn" onClick={onOpenEconomy} title="Economy Overview">₵ Economy</button>
        <button className="speed-btn" onClick={onOpenEspionage} title="Espionage">🕵 Espionage</button>
        {onOpenDiplomacy && (
          <button className="speed-btn" onClick={onOpenDiplomacy} title="Diplomacy">☮ Diplomacy</button>
        )}
      </div>

      {/* Resources */}
      <div className="top-bar__resources">
        <span className="resource-item" title="Credits">
          <span className="resource-icon">₵</span>
          <span className="resource-value">{Math.floor(credits).toLocaleString()}</span>
        </span>
        <span className="resource-item" title="Minerals">
          <span className="resource-icon">⛏</span>
          <span className="resource-value">{Math.floor(minerals).toLocaleString()}</span>
        </span>
        <span className="resource-item" title="Energy">
          <span className="resource-icon" style={{ color: energy < 0 ? '#ff4444' : undefined }}>⚡</span>
          <span className="resource-value" style={{ color: energy < 0 ? '#ff4444' : undefined }}>{Math.floor(energy).toLocaleString()}</span>
        </span>
        <span className="resource-item" title="Organics (Food)">
          <span className="resource-icon" style={{ color: organics < 0 ? '#ff4444' : undefined }}>🌾</span>
          <span className="resource-value" style={{ color: organics < 0 ? '#ff4444' : undefined }}>{Math.floor(organics).toLocaleString()}</span>
        </span>
        <span className="resource-item" title="Research">
          <span className="resource-icon">⚗</span>
          <span className="resource-value">{Math.floor(researchPoints).toLocaleString()}</span>
        </span>
      </div>
    </div>
  );
}
