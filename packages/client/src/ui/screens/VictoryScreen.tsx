/**
 * VictoryScreen — displayed when the game ends (victory or defeat).
 *
 * Shows:
 *  - A "VICTORY!" or "DEFEAT" header.
 *  - How the local player won (or which empire beat them and how).
 *  - Final scores for all empires, sorted by total score.
 *  - Game statistics (turns played, planets colonised, ships built, techs researched).
 *  - "New Game" and "Main Menu" action buttons.
 */

import React, { useMemo } from 'react';
import type { VictoryProgress } from '@nova-imperia/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GameStatistics {
  /** Total number of game ticks elapsed. */
  ticksPlayed: number;
  /** Number of planets colonised by the local player over the course of the game. */
  planetsColonised: number;
  /** Number of ships built by the local player. */
  shipsBuilt: number;
  /** Number of technologies researched by the local player. */
  techsResearched: number;
}

export interface VictoryScreenProps {
  /** Empire ID of the local player. */
  localEmpireId: string;
  /** Empire ID of the winner (may equal localEmpireId for a victory). */
  winnerEmpireId: string;
  /** Human-readable name of the winner's empire. */
  winnerEmpireName: string;
  /** The victory condition type that ended the game. */
  victoryCriteria: string;
  /** Final VictoryProgress snapshots for all empires, used for the score table. */
  allProgress: VictoryProgress[];
  /** Empire names keyed by empire ID. */
  empireNames: Record<string, string>;
  /** Empire colours (hex) keyed by empire ID. */
  empireColours: Record<string, string>;
  /** Aggregate game statistics for the local player. */
  statistics: GameStatistics;
  onNewGame: () => void;
  onMainMenu: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONDITION_LABELS: Record<string, string> = {
  conquest:      'Galactic Conquest',
  economic:      'Economic Dominance',
  technological: 'Technological Ascension',
  diplomatic:    'Galactic Federation',
  // Legacy label used by the GameConfig VictoryCriteria type
  research:      'Technological Ascension',
};

const SCORE_COLUMN_LABELS: (keyof VictoryProgress['scores'])[] = [
  'military',
  'economic',
  'technology',
  'territorial',
  'diplomatic',
];

const SCORE_COLUMN_DISPLAY: Record<keyof VictoryProgress['scores'], string> = {
  military:    'Military',
  economic:    'Economic',
  technology:  'Technology',
  territorial: 'Territorial',
  diplomatic:  'Diplomatic',
};

function conditionLabel(criteria: string): string {
  return CONDITION_LABELS[criteria] ?? criteria;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ScoreTableRowProps {
  rank: number;
  progress: VictoryProgress;
  name: string;
  colour: string;
  isLocal: boolean;
  isWinner: boolean;
}

function ScoreTableRow({
  rank,
  progress,
  name,
  colour,
  isLocal,
  isWinner,
}: ScoreTableRowProps): React.ReactElement {
  const rowClass = [
    'vs-score-row',
    isLocal ? 'vs-score-row--local' : '',
    isWinner ? 'vs-score-row--winner' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <tr className={rowClass}>
      <td className="vs-score-cell vs-score-cell--rank">{rank}</td>
      <td className="vs-score-cell vs-score-cell--name">
        <span
          className="vs-empire-colour"
          style={{ backgroundColor: colour }}
          aria-hidden="true"
        />
        {name}
        {isWinner && <span className="vs-winner-badge">Winner</span>}
        {isLocal && !isWinner && <span className="vs-local-badge">You</span>}
      </td>
      {SCORE_COLUMN_LABELS.map(col => (
        <td key={col} className="vs-score-cell vs-score-cell--num">
          {progress.scores[col].toLocaleString()}
        </td>
      ))}
      <td className="vs-score-cell vs-score-cell--total">
        {progress.totalScore.toLocaleString()}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function VictoryScreen({
  localEmpireId,
  winnerEmpireId,
  winnerEmpireName,
  victoryCriteria,
  allProgress,
  empireNames,
  empireColours,
  statistics,
  onNewGame,
  onMainMenu,
}: VictoryScreenProps): React.ReactElement {
  const isVictory = localEmpireId === winnerEmpireId;

  const sortedProgress = useMemo(
    () => [...allProgress].sort((a, b) => b.totalScore - a.totalScore),
    [allProgress],
  );

  const ticksToTurns = (ticks: number): string => {
    if (ticks < 60) return `${ticks} turns`;
    const mins = Math.floor(ticks / 60);
    return `${mins} min ${ticks % 60} turns`;
  };

  return (
    <div className="victory-screen">
      <div className="victory-screen__overlay" />

      <div className="victory-screen__modal">
        {/* Header */}
        <header className={`vs-header ${isVictory ? 'vs-header--victory' : 'vs-header--defeat'}`}>
          <div className="vs-header__title">
            {isVictory ? 'VICTORY!' : 'DEFEAT'}
          </div>
          <div className="vs-header__subtitle">
            {isVictory
              ? `You achieved ${conditionLabel(victoryCriteria)}`
              : `${winnerEmpireName} achieved ${conditionLabel(victoryCriteria)}`}
          </div>
        </header>

        {/* Score table */}
        <section className="vs-section" aria-label="Final scores">
          <div className="vs-section__title">FINAL SCORES</div>
          <div className="vs-table-wrapper">
            <table className="vs-score-table">
              <thead>
                <tr>
                  <th className="vs-th">#</th>
                  <th className="vs-th vs-th--name">Empire</th>
                  {SCORE_COLUMN_LABELS.map(col => (
                    <th key={col} className="vs-th">{SCORE_COLUMN_DISPLAY[col]}</th>
                  ))}
                  <th className="vs-th vs-th--total">Total</th>
                </tr>
              </thead>
              <tbody>
                {sortedProgress.map((prog, idx) => (
                  <ScoreTableRow
                    key={prog.empireId}
                    rank={idx + 1}
                    progress={prog}
                    name={empireNames[prog.empireId] ?? prog.empireId}
                    colour={empireColours[prog.empireId] ?? '#888888'}
                    isLocal={prog.empireId === localEmpireId}
                    isWinner={prog.empireId === winnerEmpireId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Game statistics */}
        <section className="vs-section" aria-label="Game statistics">
          <div className="vs-section__title">YOUR STATISTICS</div>
          <div className="vs-stats-grid">
            <div className="vs-stat">
              <div className="vs-stat__label">Time played</div>
              <div className="vs-stat__value">{ticksToTurns(statistics.ticksPlayed)}</div>
            </div>
            <div className="vs-stat">
              <div className="vs-stat__label">Planets colonised</div>
              <div className="vs-stat__value">{statistics.planetsColonised.toLocaleString()}</div>
            </div>
            <div className="vs-stat">
              <div className="vs-stat__label">Ships built</div>
              <div className="vs-stat__value">{statistics.shipsBuilt.toLocaleString()}</div>
            </div>
            <div className="vs-stat">
              <div className="vs-stat__label">Techs researched</div>
              <div className="vs-stat__value">{statistics.techsResearched.toLocaleString()}</div>
            </div>
          </div>
        </section>

        {/* Action buttons */}
        <footer className="vs-footer">
          <button
            type="button"
            className="vs-btn vs-btn--primary"
            onClick={onNewGame}
          >
            New Game
          </button>
          <button
            type="button"
            className="vs-btn vs-btn--secondary"
            onClick={onMainMenu}
          >
            Main Menu
          </button>
        </footer>
      </div>
    </div>
  );
}
