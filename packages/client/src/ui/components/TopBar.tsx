import React, { useCallback } from 'react';
import type { GameSpeedName } from '@nova-imperia/shared';
import { STARTING_CREDITS, STARTING_RESEARCH_POINTS } from '@nova-imperia/shared';

interface TopBarProps {
  gameSpeed: GameSpeedName;
  onSpeedChange: (speed: GameSpeedName) => void;
  credits?: number;
  researchPoints?: number;
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
}: TopBarProps): React.ReactElement {
  const handleSpeedClick = useCallback(
    (speed: GameSpeedName) => {
      onSpeedChange(speed);
    },
    [onSpeedChange],
  );

  return (
    <div className="top-bar">
      {/* Title */}
      <div className="top-bar__title">NOVA IMPERIA</div>

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

      {/* Resources placeholder */}
      <div className="top-bar__resources">
        <span className="resource-item">
          <span className="resource-icon">₵</span>
          <span className="resource-value">{credits.toLocaleString()}</span>
        </span>
        <span className="resource-item">
          <span className="resource-icon">⚗</span>
          <span className="resource-value">{researchPoints.toLocaleString()}</span>
        </span>
      </div>
    </div>
  );
}
