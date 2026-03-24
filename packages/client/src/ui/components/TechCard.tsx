import React, { useState } from 'react';
import type { Technology } from '@nova-imperia/shared';
import type { TechCardStatus } from '../screens/ResearchScreen';

interface TechCardProps {
  tech: Technology;
  status: TechCardStatus;
  progressPercent?: number; // 0-100, only for 'active'
  onClick: (tech: Technology) => void;
  /** Called when the quick-start button is clicked; only relevant for 'available' cards */
  onStartResearch?: (tech: Technology) => void;
  /** When true, the button says "Queue" instead of "Start" */
  atCapacity?: boolean;
  isSelected?: boolean;
}

// Category icons (text-based for font-mono aesthetic)
const CATEGORY_ICONS: Record<string, string> = {
  weapons:      '[WPN]',
  defense:      '[DEF]',
  propulsion:   '[PRO]',
  biology:      '[BIO]',
  construction: '[CON]',
  racial:       '[RAC]',
};

export function TechCard({
  tech,
  status,
  progressPercent = 0,
  onClick,
  onStartResearch,
  atCapacity = false,
  isSelected = false,
}: TechCardProps): React.ReactElement {
  const [hovered, setHovered] = useState(false);

  const statusClass = `tech-card--${status}`;
  const selectedClass = isSelected ? 'tech-card--selected' : '';

  return (
    <div
      className={`tech-card ${statusClass} ${selectedClass}`}
      onClick={status !== 'locked' && status !== 'future' ? () => onClick(tech) : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role={status !== 'locked' && status !== 'future' ? 'button' : undefined}
      tabIndex={status !== 'locked' && status !== 'future' ? 0 : undefined}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && status !== 'locked' && status !== 'future') {
          onClick(tech);
        }
      }}
      aria-label={`${tech.name} — ${status}`}
    >
      <div className="tech-card__icon">{CATEGORY_ICONS[tech.category] ?? '[???]'}</div>
      <div className="tech-card__name">{tech.name}</div>
      <div className="tech-card__cost">{tech.cost} RP</div>

      {/* Progress bar for active research */}
      {status === 'active' && (
        <div className="tech-card__progress-bar">
          <div
            className="tech-card__progress-fill"
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </div>
      )}

      {/* Completed checkmark */}
      {status === 'completed' && (
        <div className="tech-card__done-mark">&#10003;</div>
      )}

      {/* Quick-start button — available cards only */}
      {status === 'available' && onStartResearch && (
        <button
          type="button"
          className="tech-card__start-btn"
          onClick={(e) => {
            e.stopPropagation();
            onStartResearch(tech);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              onStartResearch(tech);
            }
          }}
          aria-label={atCapacity ? `Queue ${tech.name}` : `Start researching ${tech.name}`}
        >
          {atCapacity ? '&#9654; Queue' : '&#9654; Start'}
        </button>
      )}

      {/* Hover tooltip */}
      {hovered && (
        <div className="tech-card__tooltip">
          <div className="tech-card__tooltip-name">{tech.name}</div>
          <div className="tech-card__tooltip-desc">{tech.description}</div>
          {status === 'locked' && tech.prerequisites.length > 0 && (
            <div className="tech-card__tooltip-prereqs">
              Requires: {tech.prerequisites.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
