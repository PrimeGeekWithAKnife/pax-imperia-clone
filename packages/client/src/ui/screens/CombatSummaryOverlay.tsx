/**
 * CombatSummaryOverlay — full-screen HTML overlay shown after combat ends.
 * Replaces the in-engine Phaser battle summary with a crisp, styled overlay.
 */
import React, { useEffect } from 'react';

export interface CombatShipResult {
  name: string;
  hull: string;
  status: 'survived' | 'destroyed' | 'fled';
  hullPercent: number;
}

export interface CombatSummaryData {
  outcome: 'victory' | 'defeat' | 'draw';
  attackerName: string;
  defenderName: string;
  attackerColor: string;
  defenderColor: string;
  playerShips: CombatShipResult[];
  enemyShips: CombatShipResult[];
  ticksElapsed: number;
}

export interface CombatSummaryProps {
  data: CombatSummaryData;
  onContinue: () => void;
}

export function CombatSummaryOverlay({
  data,
  onContinue,
}: CombatSummaryProps): React.ReactElement {

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

  const playerDestroyed = data.playerShips.filter(s => s.status === 'destroyed').length;
  const playerFled = data.playerShips.filter(s => s.status === 'fled').length;
  const playerSurvived = data.playerShips.filter(s => s.status === 'survived').length;
  const enemyDestroyed = data.enemyShips.filter(s => s.status === 'destroyed').length;
  const enemySurvived = data.enemyShips.filter(s => s.status === 'survived').length;

  const outcomeText = data.outcome === 'victory' ? 'VICTORY'
    : data.outcome === 'defeat' ? 'DEFEAT' : 'DRAW';
  const outcomeClass = data.outcome === 'victory' ? 'combat-summary-victory'
    : data.outcome === 'defeat' ? 'combat-summary-defeat' : 'combat-summary-draw';

  return (
    <div className="combat-instructions-overlay">
      <div className="combat-instructions-panel">
        <h1 className={`combat-instructions-title ${outcomeClass}`}>{outcomeText}</h1>
        <p className="combat-summary-subtitle">
          <span style={{ color: data.attackerColor }}>{data.attackerName}</span>
          {' vs '}
          <span style={{ color: data.defenderColor }}>{data.defenderName}</span>
          {' — '}{data.ticksElapsed} ticks
        </p>

        <div className="combat-instructions-columns">
          <div className="combat-instructions-col">
            <h2 className="combat-instructions-heading">YOUR FLEET</h2>
            <div className="combat-summary-ships">
              {data.playerShips.map((ship, i) => (
                <div key={i} className={`combat-summary-ship combat-summary-ship--${ship.status}`}>
                  <span className="combat-summary-ship-name">{ship.name}</span>
                  {ship.status === 'survived' && (
                    <span className="combat-summary-ship-hull">Hull {ship.hullPercent}%</span>
                  )}
                  {ship.status === 'destroyed' && (
                    <span className="combat-summary-ship-status">Destroyed</span>
                  )}
                  {ship.status === 'fled' && (
                    <span className="combat-summary-ship-status combat-summary-ship-fled">Fled</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="combat-instructions-col">
            <h2 className="combat-instructions-heading">ENEMY FLEET</h2>
            <div className="combat-summary-ships">
              {data.enemyShips.map((ship, i) => (
                <div key={i} className={`combat-summary-ship combat-summary-ship--${ship.status}`}>
                  <span className="combat-summary-ship-name">{ship.name}</span>
                  {ship.status === 'survived' && (
                    <span className="combat-summary-ship-hull">Hull {ship.hullPercent}%</span>
                  )}
                  {ship.status === 'destroyed' && (
                    <span className="combat-summary-ship-status">Destroyed</span>
                  )}
                  {ship.status === 'fled' && (
                    <span className="combat-summary-ship-status combat-summary-ship-fled">Fled</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="combat-summary-stats">
          <span>Your losses: <strong>{playerDestroyed} destroyed</strong>{playerFled > 0 ? `, ${playerFled} fled` : ''}, <strong>{playerSurvived} survived</strong></span>
          <span>Enemy losses: <strong>{enemyDestroyed} destroyed</strong>, <strong>{enemySurvived} survived</strong></span>
        </div>

        <button
          className="combat-instructions-begin"
          onClick={onContinue}
          autoFocus
        >
          CONTINUE
        </button>
        <p className="combat-instructions-hint">Press Enter or Space to continue</p>
      </div>
    </div>
  );
}
