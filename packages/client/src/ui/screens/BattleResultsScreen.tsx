import React, { useCallback, useEffect } from 'react';
import type { BattleReport, CrewExperience } from '@nova-imperia/shared';

// ── Public types ──────────────────────────────────────────────────────────────

export interface BattleShipRecord {
  id: string;
  name: string;
  /** Visual hull class used to derive a simple icon. */
  hull: string;
  /** 'survived' | 'destroyed' | 'routed' */
  status: 'survived' | 'destroyed' | 'routed';
  /** Experience level after combat, if promoted. */
  newExperience?: CrewExperience;
  /** Experience level before combat. */
  previousExperience?: CrewExperience;
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
  /** Detailed battle report with salvage, damage, and experience data. */
  battleReport?: BattleReport;
}

export interface BattleResultsScreenProps {
  data: BattleResultsData;
  onContinue: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return a short Unicode symbol representing the ship's hull class. */
function shipIcon(hull: string): string {
  switch (hull) {
    case 'patrol':           return '\u25C7';
    case 'corvette':
    case 'frigate':
    case 'destroyer':        return '\u25B7';
    case 'transport':
    case 'large_transport':
    case 'cargo':
    case 'large_cargo':      return '\u25AD';
    case 'light_cruiser':
    case 'heavy_cruiser':    return '\u25B6';
    case 'carrier':
    case 'super_carrier':    return '\u25C8';
    case 'battleship':
    case 'light_battleship':
    case 'heavy_battleship': return '\u25C6';
    default:                 return '\u25B8';
  }
}

function statusLabel(status: BattleShipRecord['status']): string {
  switch (status) {
    case 'survived':  return 'Survived';
    case 'destroyed': return 'Destroyed';
    case 'routed':    return 'Fled';
  }
}

function experienceLabel(exp: CrewExperience): string {
  switch (exp) {
    case 'green':   return 'Green';
    case 'regular': return 'Regular';
    case 'veteran': return 'Veteran';
    case 'elite':   return 'Elite';
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
      {ships.map((ship) => {
        const promoted =
          ship.newExperience &&
          ship.previousExperience &&
          ship.newExperience !== ship.previousExperience;
        return (
          <li
            key={ship.id}
            className={`brs-ship-row brs-ship-row--${ship.status}`}
          >
            <span className="brs-ship-icon" aria-hidden="true">
              {shipIcon(ship.hull)}
            </span>
            <span className="brs-ship-name">{ship.name}</span>
            {promoted && (
              <span className="brs-ship-promotion" title={`Promoted to ${experienceLabel(ship.newExperience!)}`}>
                {experienceLabel(ship.newExperience!)}
              </span>
            )}
            <span className="brs-ship-status">{statusLabel(ship.status)}</span>
          </li>
        );
      })}
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
    battleReport,
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

  const attackerDestroyed = attacker.ships.filter(s => s.status === 'destroyed').length;
  const attackerFled = attacker.ships.filter(s => s.status === 'routed').length;
  const defenderDestroyed = defender.ships.filter(s => s.status === 'destroyed').length;
  const defenderFled = defender.ships.filter(s => s.status === 'routed').length;

  let victoryText: string;
  if (winner === 'draw') {
    victoryText = 'Draw \u2014 both sides withdrew';
  } else {
    const winnerName = winner === 'attacker' ? attacker.empireName : defender.empireName;
    victoryText = `Victory for ${winnerName}`;
  }

  // Promotion counts
  const attackerPromotions = attacker.ships.filter(
    s => s.newExperience && s.previousExperience && s.newExperience !== s.previousExperience,
  ).length;
  const defenderPromotions = defender.ships.filter(
    s => s.newExperience && s.previousExperience && s.newExperience !== s.previousExperience,
  ).length;

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
              <span className="brs-stat-label">Attacker destroyed</span>
              <span className="brs-stat-value brs-stat-value--destroyed">{attackerDestroyed} / {attacker.ships.length}</span>
            </div>
            {attackerFled > 0 && (
              <div className="brs-stat">
                <span className="brs-stat-label">Attacker fled</span>
                <span className="brs-stat-value brs-stat-value--fled">{attackerFled}</span>
              </div>
            )}
            <div className="brs-stat">
              <span className="brs-stat-label">Defender destroyed</span>
              <span className="brs-stat-value brs-stat-value--destroyed">{defenderDestroyed} / {defender.ships.length}</span>
            </div>
            {defenderFled > 0 && (
              <div className="brs-stat">
                <span className="brs-stat-label">Defender fled</span>
                <span className="brs-stat-value brs-stat-value--fled">{defenderFled}</span>
              </div>
            )}
            <div className="brs-stat">
              <span className="brs-stat-label">Combat duration</span>
              <span className="brs-stat-value">{ticksElapsed}</span>
            </div>
            {battleReport && (
              <>
                <div className="brs-stat">
                  <span className="brs-stat-label">Attacker damage</span>
                  <span className="brs-stat-value">{battleReport.attacker.totalDamageDealt}</span>
                </div>
                <div className="brs-stat">
                  <span className="brs-stat-label">Defender damage</span>
                  <span className="brs-stat-value">{battleReport.defender.totalDamageDealt}</span>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── Experience promotions ── */}
        {(attackerPromotions > 0 || defenderPromotions > 0) && (
          <section className="brs-experience">
            <h3 className="brs-section-heading">CREW PROMOTIONS</h3>
            <div className="brs-experience-row">
              {attackerPromotions > 0 && (
                <span className="brs-experience-item" style={{ color: attacker.empireColor }}>
                  {attacker.empireName}: {attackerPromotions} crew{attackerPromotions !== 1 ? 's' : ''} promoted
                </span>
              )}
              {defenderPromotions > 0 && (
                <span className="brs-experience-item" style={{ color: defender.empireColor }}>
                  {defender.empireName}: {defenderPromotions} crew{defenderPromotions !== 1 ? 's' : ''} promoted
                </span>
              )}
            </div>
          </section>
        )}

        {/* ── Salvage ── */}
        {battleReport && (battleReport.salvage.credits > 0 || battleReport.salvage.minerals > 0) && (
          <section className="brs-salvage">
            <h3 className="brs-section-heading">SALVAGE RECOVERED</h3>
            <div className="brs-salvage-items">
              {battleReport.salvage.credits > 0 && (
                <div className="brs-salvage-item">
                  <span className="brs-salvage-label">Credits</span>
                  <span className="brs-salvage-value">+{battleReport.salvage.credits}</span>
                </div>
              )}
              {battleReport.salvage.minerals > 0 && (
                <div className="brs-salvage-item">
                  <span className="brs-salvage-label">Minerals</span>
                  <span className="brs-salvage-value">+{battleReport.salvage.minerals}</span>
                </div>
              )}
              {battleReport.salvage.techFragments.length > 0 && (
                <div className="brs-salvage-item">
                  <span className="brs-salvage-label">Tech fragments</span>
                  <span className="brs-salvage-value">{battleReport.salvage.techFragments.length}</span>
                </div>
              )}
            </div>
          </section>
        )}

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
