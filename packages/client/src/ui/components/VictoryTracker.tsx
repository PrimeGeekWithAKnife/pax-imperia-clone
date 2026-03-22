/**
 * VictoryTracker panel — displayed in the bottom-right corner above the minimap
 * during active gameplay.
 *
 * Shows:
 *  - Score breakdown across the five categories for the player's empire.
 *  - Progress bars for each victory condition.
 *  - A warning when any rival empire is close to winning (progress >= 75 %).
 */

import React, { useMemo } from 'react';
import type { VictoryProgress, VictoryConditionStatus } from '@nova-imperia/shared';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ScoreRowProps {
  label: string;
  value: number;
  icon: string;
}

function ScoreRow({ label, value, icon }: ScoreRowProps): React.ReactElement {
  return (
    <div className="vt-score-row">
      <span className="vt-score-row__icon" aria-hidden="true">{icon}</span>
      <span className="vt-score-row__label">{label}</span>
      <span className="vt-score-row__value">{value.toLocaleString()}</span>
    </div>
  );
}

interface ConditionBarProps {
  status: VictoryConditionStatus;
}

function ConditionBar({ status }: ConditionBarProps): React.ReactElement {
  const barClass = status.isAchieved
    ? 'vt-condition-bar__fill vt-condition-bar__fill--achieved'
    : status.progress >= 75
      ? 'vt-condition-bar__fill vt-condition-bar__fill--near'
      : 'vt-condition-bar__fill';

  return (
    <div className="vt-condition" title={status.description}>
      <div className="vt-condition__header">
        <span className="vt-condition__name">{status.name}</span>
        <span className="vt-condition__pct">{status.progress}%</span>
      </div>
      <div className="vt-condition-bar">
        <div
          className={barClass}
          style={{ width: `${status.progress}%` }}
          role="progressbar"
          aria-valuenow={status.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={status.name}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main props / component
// ---------------------------------------------------------------------------

export interface VictoryTrackerProps {
  /** Victory progress snapshot for the local player's empire. */
  playerProgress: VictoryProgress;
  /** Victory progress snapshots for rival empires (used for proximity warnings). */
  rivalProgress?: VictoryProgress[];
  /** Whether the panel is collapsed (shows only a summary line). */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const SCORE_ICONS: Record<keyof VictoryProgress['scores'], string> = {
  military: '⚔',
  economic: '◈',
  technology: '⬡',
  territorial: '◉',
  diplomatic: '✦',
};

const SCORE_LABELS: Record<keyof VictoryProgress['scores'], string> = {
  military: 'Military',
  economic: 'Economic',
  technology: 'Technology',
  territorial: 'Territorial',
  diplomatic: 'Diplomatic',
};

export function VictoryTracker({
  playerProgress,
  rivalProgress = [],
  collapsed = false,
  onToggleCollapse,
}: VictoryTrackerProps): React.ReactElement {
  const { scores, totalScore, victoryConditions } = playerProgress;

  // Determine whether any rival is dangerously close to winning.
  const rivalWarnings = useMemo((): string[] => {
    const warnings: string[] = [];
    for (const rival of rivalProgress) {
      for (const cond of rival.victoryConditions) {
        if (!cond.isAchieved && cond.progress >= 75) {
          warnings.push(`Empire ${rival.empireId} is close to victory via ${cond.name}!`);
        }
        if (cond.isAchieved) {
          warnings.push(`Empire ${rival.empireId} has achieved ${cond.name}!`);
        }
      }
    }
    return warnings;
  }, [rivalProgress]);

  return (
    <div className="victory-tracker">
      {/* Header / collapse toggle */}
      <button
        type="button"
        className="vt-header"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
      >
        <span className="vt-header__title">SCORE</span>
        <span className="vt-header__total">{totalScore.toLocaleString()}</span>
        <span className="vt-header__chevron">{collapsed ? '▲' : '▼'}</span>
      </button>

      {!collapsed && (
        <div className="vt-body">
          {/* Score breakdown */}
          <section className="vt-section" aria-label="Score breakdown">
            <div className="vt-section__title">BREAKDOWN</div>
            {(Object.keys(scores) as Array<keyof typeof scores>).map(key => (
              <ScoreRow
                key={key}
                label={SCORE_LABELS[key]}
                value={scores[key]}
                icon={SCORE_ICONS[key]}
              />
            ))}
          </section>

          {/* Victory condition progress bars */}
          <section className="vt-section" aria-label="Victory conditions">
            <div className="vt-section__title">CONDITIONS</div>
            {victoryConditions.map(cond => (
              <ConditionBar key={cond.type} status={cond} />
            ))}
          </section>

          {/* Rival proximity warnings */}
          {rivalWarnings.length > 0 && (
            <section className="vt-section vt-section--warning" aria-label="Rivalry warnings">
              <div className="vt-section__title vt-section__title--warning">WARNING</div>
              {rivalWarnings.map((w, i) => (
                <div key={i} className="vt-warning">
                  {w}
                </div>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
