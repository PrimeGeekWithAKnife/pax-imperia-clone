/**
 * CombatInstructionsOverlay — full-screen HTML overlay shown before combat begins.
 */
import React, { useState, useEffect } from 'react';

export interface CombatInstructionsData {
  attackerName: string;
  defenderName: string;
  attackerColor: string;
  defenderColor: string;
  attackerShipCount: number;
  defenderShipCount: number;
  battlefieldSize: string;
}

export interface CombatInstructionsResult {
  formation: string;
  stance: string;
}

export interface CombatInstructionsProps {
  data: CombatInstructionsData;
  onBeginBattle: (result: CombatInstructionsResult) => void;
}

const FORMATIONS = [
  { key: 'line', label: 'Line', desc: 'Ships in a row — all guns forward' },
  { key: 'spearhead', label: 'Spearhead', desc: 'Arrow formation — fast ships lead' },
  { key: 'diamond', label: 'Diamond', desc: 'Balanced — centre protected' },
  { key: 'wings', label: 'Wings', desc: 'Flanking — envelop the enemy' },
];

const STANCES = [
  { key: 'aggressive', label: 'Aggressive', desc: 'Close and engage' },
  { key: 'defensive', label: 'Defensive', desc: 'Hold position, return fire' },
  { key: 'at_ease', label: 'At Ease', desc: 'Captain\'s judgement' },
  { key: 'evasive', label: 'Evasive', desc: 'Maintain distance, kite' },
];

export function CombatInstructionsOverlay({
  data,
  onBeginBattle,
}: CombatInstructionsProps): React.ReactElement {
  const [formation, setFormation] = useState('line');
  const [stance, setStance] = useState('aggressive');

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onBeginBattle({ formation, stance });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onBeginBattle, formation, stance]);

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
            <h2 className="combat-instructions-heading">FORMATION</h2>
            <div className="combat-instructions-options">
              {FORMATIONS.map(f => (
                <button
                  key={f.key}
                  className={`combat-instructions-option ${formation === f.key ? 'combat-instructions-option--active' : ''}`}
                  onClick={() => setFormation(f.key)}
                >
                  <strong>{f.label}</strong>
                  <span>{f.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="combat-instructions-col">
            <h2 className="combat-instructions-heading">STANCE</h2>
            <div className="combat-instructions-options">
              {STANCES.map(s => (
                <button
                  key={s.key}
                  className={`combat-instructions-option ${stance === s.key ? 'combat-instructions-option--active' : ''}`}
                  onClick={() => setStance(s.key)}
                >
                  <strong>{s.label}</strong>
                  <span>{s.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="combat-instructions-controls">
          <h2 className="combat-instructions-heading">CONTROLS</h2>
          <div className="combat-instructions-controls-grid">
            <span><strong>Left-click</strong> select</span>
            <span><strong>Ctrl+A</strong> select all</span>
            <span><strong>Right-click</strong> attack/move</span>
            <span><strong>Scroll</strong> zoom</span>
            <span><strong>Middle-drag</strong> pan</span>
            <span><strong>Space</strong> pause</span>
          </div>
        </div>

        <button
          className="combat-instructions-begin"
          onClick={() => onBeginBattle({ formation, stance })}
          autoFocus
        >
          BEGIN BATTLE
        </button>
        <p className="combat-instructions-hint">Press Enter or Space to begin</p>
      </div>
    </div>
  );
}
