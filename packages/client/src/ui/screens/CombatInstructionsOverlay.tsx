/**
 * CombatInstructionsOverlay — full-screen HTML overlay shown before combat begins.
 * Replaces the in-engine Phaser text panel with a crisp, zoom-independent overlay.
 */
import React, { useCallback, useEffect } from 'react';

export interface CombatInstructionsData {
  attackerName: string;
  defenderName: string;
  attackerColor: string;
  defenderColor: string;
  attackerShipCount: number;
  defenderShipCount: number;
  battlefieldSize: string;
}

export interface CombatInstructionsProps {
  data: CombatInstructionsData;
  onBeginBattle: () => void;
}

export function CombatInstructionsOverlay({
  data,
  onBeginBattle,
}: CombatInstructionsProps): React.ReactElement {

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onBeginBattle();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onBeginBattle]);

  return (
    <div className="combat-instructions-overlay">
      <div className="combat-instructions-panel">
        <h1 className="combat-instructions-title">TACTICAL COMBAT</h1>

        <div className="combat-instructions-fleets">
          <div className="combat-instructions-side">
            <span className="combat-instructions-empire" style={{ color: data.attackerColor }}>
              {data.attackerName}
            </span>
            <span className="combat-instructions-count">{data.attackerShipCount} ships</span>
          </div>
          <span className="combat-instructions-vs">VS</span>
          <div className="combat-instructions-side">
            <span className="combat-instructions-empire" style={{ color: data.defenderColor }}>
              {data.defenderName}
            </span>
            <span className="combat-instructions-count">{data.defenderShipCount} ships</span>
          </div>
        </div>

        <div className="combat-instructions-columns">
          <div className="combat-instructions-col">
            <h2 className="combat-instructions-heading">CONTROLS</h2>
            <ul className="combat-instructions-list">
              <li><strong>Left-click</strong> — select ship</li>
              <li><strong>Ctrl+A</strong> — select all</li>
              <li><strong>Right-click</strong> — attack/move</li>
              <li><strong>Shift+Right</strong> — attack-move</li>
              <li><strong>Scroll</strong> — zoom in/out</li>
              <li><strong>Middle drag / Shift+drag</strong> — pan camera</li>
              <li><strong>Space</strong> — pause/resume</li>
            </ul>
          </div>
          <div className="combat-instructions-col">
            <h2 className="combat-instructions-heading">TIPS</h2>
            <ul className="combat-instructions-list">
              <li>Ships obey their <strong>stance</strong> — aggressive, defensive, at ease, evasive</li>
              <li>Use <strong>formations</strong> to position your fleet</li>
              <li>Ships that enter the <strong>flee zone</strong> will leave the battle</li>
              <li>Unmanned craft (drones) fight to destruction</li>
              <li>Map size: <strong>{data.battlefieldSize}</strong></li>
            </ul>
          </div>
        </div>

        <button
          className="combat-instructions-begin"
          onClick={onBeginBattle}
          autoFocus
        >
          BEGIN BATTLE
        </button>
        <p className="combat-instructions-hint">Press Enter or Space to begin</p>
      </div>
    </div>
  );
}
