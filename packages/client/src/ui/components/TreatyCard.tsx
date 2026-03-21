import React from 'react';
import type { Treaty, TreatyType } from '@nova-imperia/shared';

// ── Type labels and icons ─────────────────────────────────────────────────────

const TREATY_LABELS: Record<TreatyType, string> = {
  non_aggression:   'Non-Aggression Pact',
  trade:            'Trade Agreement',
  research_sharing: 'Research Sharing',
  mutual_defense:   'Mutual Defense',
  alliance:         'Alliance',
};

const TREATY_ICONS: Record<TreatyType, string> = {
  non_aggression:   '☮',
  trade:            '⚖',
  research_sharing: '⚗',
  mutual_defense:   '⛊',
  alliance:         '★',
};

const TREATY_DESCRIPTIONS: Record<TreatyType, string> = {
  non_aggression:   'Neither empire will initiate hostile actions.',
  trade:            'Establishes active trade routes and credits exchange.',
  research_sharing: 'Both empires share research breakthroughs.',
  mutual_defense:   'If attacked, both empires defend each other.',
  alliance:         'Full military and diplomatic partnership.',
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TreatyCardProps {
  treaty: Treaty;
  /** Current game turn (to calculate turns remaining) */
  currentTurn: number;
  onBreak?: (treaty: Treaty) => void;
  onClick?: (treaty: Treaty) => void;
  /** When true the Break button is shown */
  canBreak?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTurnsRemaining(treaty: Treaty, currentTurn: number): number | null {
  if (treaty.duration === -1) return null; // permanent
  const expiresAt = treaty.startTurn + treaty.duration;
  return Math.max(0, expiresAt - currentTurn);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TreatyCard({
  treaty,
  currentTurn,
  onBreak,
  onClick,
  canBreak = true,
}: TreatyCardProps): React.ReactElement {
  const turnsLeft    = getTurnsRemaining(treaty, currentTurn);
  const isPermanent  = turnsLeft === null;
  const isExpiring   = turnsLeft !== null && turnsLeft <= 5;

  const handleClick = (): void => {
    onClick?.(treaty);
  };

  const handleBreak = (e: React.MouseEvent): void => {
    e.stopPropagation();
    onBreak?.(treaty);
  };

  return (
    <div
      className={`treaty-card treaty-card--${treaty.type} ${onClick ? 'treaty-card--clickable' : ''}`}
      onClick={onClick ? handleClick : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); } : undefined}
    >
      <div className="treaty-card__icon">
        {TREATY_ICONS[treaty.type]}
      </div>

      <div className="treaty-card__body">
        <div className="treaty-card__name">{TREATY_LABELS[treaty.type]}</div>
        <div className="treaty-card__desc">{TREATY_DESCRIPTIONS[treaty.type]}</div>

        <div className="treaty-card__footer">
          {isPermanent ? (
            <span className="treaty-card__duration treaty-card__duration--permanent">
              Permanent
            </span>
          ) : (
            <span className={`treaty-card__duration ${isExpiring ? 'treaty-card__duration--expiring' : ''}`}>
              {turnsLeft === 0 ? 'Expires this turn' : `${turnsLeft} turns remaining`}
            </span>
          )}
        </div>
      </div>

      {canBreak && onBreak && (
        <button
          type="button"
          className="treaty-card__break-btn"
          onClick={handleBreak}
          title="Break this treaty (will reduce trust)"
        >
          Break
        </button>
      )}
    </div>
  );
}
