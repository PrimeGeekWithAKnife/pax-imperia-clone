import React, { useCallback, useEffect } from 'react';

// ── Public types ──────────────────────────────────────────────────────────────

export interface BattleShipRecord {
  id: string;
  name: string;
  /** Visual hull class used to derive a simple icon. */
  hull: string;
  /** 'survived' | 'destroyed' | 'routed' */
  status: 'survived' | 'destroyed' | 'routed';
}

export interface BattleSide {
  empireName: string;
  empireColor: string;
  ships: BattleShipRecord[];
}

export interface BattleResultsData {
  systemName: string;
  attacker: BattleSide;
  defender: BattleSide;
  /** 'attacker' | 'defender' | 'draw' */
  winner: 'attacker' | 'defender' | 'draw';
  /** Whether the system changed ownership as a result of this battle. */
  systemControlChanged: boolean;
  newOwnerName?: string;
  ticksElapsed: number;
}

export interface BattleResultsScreenProps {
  data: BattleResultsData;
  onContinue: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return a short Unicode symbol representing the ship's hull class. */
function shipIcon(hull: string): string {
  switch (hull) {
    case 'scout':      return '◇';
    case 'destroyer':  return '▷';
    case 'transport':  return '▭';
    case 'cruiser':    return '▶';
    case 'carrier':    return '◈';
    case 'battleship': return '◆';
    default:           return '▸';
  }
}

function statusLabel(status: BattleShipRecord['status']): string {
  switch (status) {
    case 'survived':  return 'Survived';
    case 'destroyed': return 'Destroyed';
    case 'routed':    return 'Routed';
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface ShipListProps {
  ships: BattleShipRecord[];
  align: 'left' | 'right';
}

function ShipList({ ships, align }: ShipListProps): React.ReactElement {
  return (
    <ul
      className={`brs-ship-list brs-ship-list--${align}`}
      aria-label={`${align === 'left' ? 'Attacker' : 'Defender'} ships`}
    >
      {ships.map((ship) => (
        <li
          key={ship.id}
          className={`brs-ship-row brs-ship-row--${ship.status}`}
        >
          <span className="brs-ship-icon" aria-hidden="true">
            {shipIcon(ship.hull)}
          </span>
          <span className="brs-ship-name">{ship.name}</span>
          <span className="brs-ship-status">{statusLabel(ship.status)}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function BattleResultsScreen({
  data,
  onContinue,
}: BattleResultsScreenProps): React.ReactElement {
  const {
    systemName,
    attacker,
    defender,
    winner,
    systemControlChanged,
    newOwnerName,
    ticksElapsed,
  } = data;

  // Allow "Enter" or Space to dismiss
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onContinue();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onContinue]);

  const handleContinue = useCallback(() => {
    onContinue();
  }, [onContinue]);

  const attackerLost = attacker.ships.filter(
    (s) => s.status === 'destroyed' || s.status === 'routed',
  ).length;
  const defenderLost = defender.ships.filter(
    (s) => s.status === 'destroyed' || s.status === 'routed',
  ).length;

  let victoryText: string;
  if (winner === 'draw') {
    victoryText = 'Draw — both sides withdrew';
  } else {
    const winnerName = winner === 'attacker' ? attacker.empireName : defender.empireName;
    victoryText = `Victory for ${winnerName}`;
  }

  return (
    <div className="brs-overlay" role="dialog" aria-modal="true" aria-label="Battle results">
      <div className="brs-modal">

        {/* ── Header ── */}
        <header className="brs-header">
          <h1 className="brs-title">BATTLE AT {systemName.toUpperCase()}</h1>
          <div className="brs-empires">
            <span
              className="brs-empire-name brs-empire-name--attacker"
              style={{ color: attacker.empireColor }}
            >
              {attacker.empireName}
            </span>
            <span className="brs-vs">VS</span>
            <span
              className="brs-empire-name brs-empire-name--defender"
              style={{ color: defender.empireColor }}
            >
              {defender.empireName}
            </span>
          </div>
        </header>

        {/* ── Ship comparison ── */}
        <section className="brs-ships" aria-label="Ship comparison">
          <div className="brs-ships-col">
            <h2 className="brs-col-heading">ATTACKER</h2>
            <ShipList ships={attacker.ships} align="left" />
          </div>
          <div className="brs-ships-divider" aria-hidden="true" />
          <div className="brs-ships-col">
            <h2 className="brs-col-heading">DEFENDER</h2>
            <ShipList ships={defender.ships} align="right" />
          </div>
        </section>

        {/* ── Battle summary ── */}
        <section className="brs-summary">
          <p
            className={`brs-victory-text ${winner === 'draw' ? 'brs-victory-text--draw' : ''}`}
          >
            {victoryText}
          </p>
          <div className="brs-stats">
            <div className="brs-stat">
              <span className="brs-stat-label">Ships lost (attacker)</span>
              <span className="brs-stat-value">{attackerLost}</span>
            </div>
            <div className="brs-stat">
              <span className="brs-stat-label">Ships lost (defender)</span>
              <span className="brs-stat-value">{defenderLost}</span>
            </div>
            <div className="brs-stat">
              <span className="brs-stat-label">Combat ticks</span>
              <span className="brs-stat-value">{ticksElapsed}</span>
            </div>
          </div>
        </section>

        {/* ── Consequences ── */}
        {systemControlChanged && (
          <section className="brs-consequences">
            <p className="brs-consequence-item">
              System control transferred to{' '}
              <strong className="brs-consequence-owner">
                {newOwnerName ?? 'unknown empire'}
              </strong>
            </p>
          </section>
        )}

        {/* ── Continue button ── */}
        <footer className="brs-footer">
          <button
            type="button"
            className="brs-continue-btn"
            onClick={handleContinue}
            autoFocus
          >
            Continue
          </button>
          <p className="brs-continue-hint">Press Enter or Space to continue</p>
        </footer>

      </div>
    </div>
  );
}
