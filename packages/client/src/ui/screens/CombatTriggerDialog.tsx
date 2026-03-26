import React from 'react';

export interface CombatTriggerDialogProps {
  attackerName: string;
  defenderName: string;
  attackerShipCount: number;
  defenderShipCount: number;
  attackerColor: string;
  defenderColor: string;
  isPlayerAttacker: boolean;
  /** True if the enemy initiated (aggressive stance) */
  enemyInitiated: boolean;
  onEngage: () => void;
  onFlee: () => void;
  onHail: () => void;
  onClose: () => void;
}

export function CombatTriggerDialog({
  attackerName, defenderName, attackerShipCount, defenderShipCount,
  attackerColor, defenderColor, isPlayerAttacker, enemyInitiated,
  onEngage, onFlee, onHail, onClose,
}: CombatTriggerDialogProps): React.ReactElement {
  const enemyName = isPlayerAttacker ? defenderName : attackerName;
  const enemyShips = isPlayerAttacker ? defenderShipCount : attackerShipCount;
  const enemyColor = isPlayerAttacker ? defenderColor : attackerColor;
  const playerShips = isPlayerAttacker ? attackerShipCount : defenderShipCount;

  return (
    <div className="ctd-overlay">
      <div className="ctd-backdrop" />
      <div className="ctd-modal">
        <div className="ctd-header">
          {enemyInitiated ? 'HOSTILE FLEET ENGAGING' : 'HOSTILE FLEET DETECTED'}
        </div>

        {enemyInitiated && (
          <div className="ctd-warning">
            Enemy fleet is powering weapons!
          </div>
        )}

        <div className="ctd-fleets">
          <div className="ctd-fleet">
            <div className="ctd-fleet__label">YOUR FLEET</div>
            <div className="ctd-fleet__count">{playerShips} ships</div>
          </div>
          <div className="ctd-vs">VS</div>
          <div className="ctd-fleet ctd-fleet--enemy">
            <div className="ctd-fleet__label" style={{ color: enemyColor }}>{enemyName}</div>
            <div className="ctd-fleet__count">{enemyShips} ships</div>
          </div>
        </div>

        <div className="ctd-actions">
          <button type="button" className="sc-btn sc-btn--danger ctd-btn" onClick={onEngage}>
            Engage
          </button>
          <button type="button" className="sc-btn sc-btn--secondary ctd-btn" onClick={onFlee}>
            Flee
          </button>
          <button type="button" className="sc-btn sc-btn--secondary ctd-btn" onClick={onHail}>
            Hail
          </button>
        </div>

        <button type="button" className="ctd-close panel-close-btn" onClick={onClose}>&#x2715;</button>
      </div>
    </div>
  );
}
