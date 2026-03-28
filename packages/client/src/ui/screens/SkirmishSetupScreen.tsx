/**
 * SkirmishSetupScreen — pre-battle setup for the Space Battle (skirmish) mode.
 *
 * Two columns: Player side and AI side.
 * Each side picks a species, a tech age, and up to 9 ships from available hull classes.
 * Hit "Start Battle" to launch directly into CombatScene.
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { Species, HullClass, TechAge } from '@nova-imperia/shared';
import {
  PREBUILT_SPECIES,
  HULL_TEMPLATES,
  SHIP_COMPONENTS,
  generateDefaultDesigns,
  getAvailableComponents,
  generateId,
  HULL_TEMPLATE_BY_CLASS,
  TECH_AGES,
} from '@nova-imperia/shared';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SkirmishConfig {
  playerSpecies: Species;
  aiSpecies: Species;
  playerShips: HullClass[];
  aiShips: HullClass[];
  techAge: TechAge;
}

export interface SkirmishSetupScreenProps {
  onBack: () => void;
  onStartBattle: (config: SkirmishConfig) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const AGE_OPTIONS: Array<{ key: TechAge; label: string }> = TECH_AGES.map(a => ({
  key: a.name as TechAge,
  label: a.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
}));

const MAX_SHIPS = 9;

/** Hull classes available at or before the given tech age. */
function getAvailableHulls(age: TechAge): Array<{ class: HullClass; name: string; hp: number }> {
  const ageIdx = TECH_AGES.findIndex(a => a.name === age);
  return HULL_TEMPLATES
    .filter(h => {
      const hullAgeIdx = TECH_AGES.findIndex(a => a.name === h.requiredAge);
      return hullAgeIdx <= ageIdx && h.class !== 'coloniser' && h.class !== 'deep_space_probe';
    })
    .map(h => ({ class: h.class as HullClass, name: h.name, hp: h.baseHullPoints }));
}

/** Colour associated with a species (simple hash). */
function speciesColor(id: string): string {
  const colors = [
    '#00d4ff', '#ff6644', '#44ff88', '#ffcc00', '#cc44ff',
    '#ff4488', '#44ccff', '#88ff44', '#ff8844', '#4488ff',
    '#ff44cc', '#44ffcc', '#ccff44', '#8844ff', '#ffff44',
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

// ── Component ──────────────────────────────────────────────────────────────────

export function SkirmishSetupScreen({ onBack, onStartBattle }: SkirmishSetupScreenProps): React.ReactElement {
  const [playerSpeciesId, setPlayerSpeciesId] = useState(PREBUILT_SPECIES[0].id);
  const [aiSpeciesId, setAiSpeciesId] = useState(PREBUILT_SPECIES[1].id);
  const [techAge, setTechAge] = useState<TechAge>('nano_atomic');
  const [playerShips, setPlayerShips] = useState<HullClass[]>(['scout', 'destroyer']);
  const [aiShips, setAiShips] = useState<HullClass[]>(['scout', 'destroyer']);

  const availableHulls = useMemo(() => getAvailableHulls(techAge), [techAge]);
  const playerSpecies = useMemo(() => PREBUILT_SPECIES.find(s => s.id === playerSpeciesId) ?? PREBUILT_SPECIES[0], [playerSpeciesId]);
  const aiSpecies = useMemo(() => PREBUILT_SPECIES.find(s => s.id === aiSpeciesId) ?? PREBUILT_SPECIES[1], [aiSpeciesId]);

  const addShip = useCallback((side: 'player' | 'ai', hull: HullClass) => {
    const setter = side === 'player' ? setPlayerShips : setAiShips;
    setter(prev => prev.length >= MAX_SHIPS ? prev : [...prev, hull]);
  }, []);

  const removeShip = useCallback((side: 'player' | 'ai', idx: number) => {
    const setter = side === 'player' ? setPlayerShips : setAiShips;
    setter(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleStart = useCallback(() => {
    if (playerShips.length === 0 || aiShips.length === 0) return;
    onStartBattle({
      playerSpecies,
      aiSpecies,
      playerShips,
      aiShips,
      techAge,
    });
  }, [playerSpecies, aiSpecies, playerShips, aiShips, techAge, onStartBattle]);

  // Reset ships when tech age changes (some hulls may no longer be available)
  const handleAgeChange = useCallback((age: TechAge) => {
    setTechAge(age);
    const hulls = getAvailableHulls(age);
    const hullSet = new Set(hulls.map(h => h.class));
    setPlayerShips(prev => prev.filter(h => hullSet.has(h)));
    setAiShips(prev => prev.filter(h => hullSet.has(h)));
  }, []);

  const canStart = playerShips.length > 0 && aiShips.length > 0;

  return (
    <div className="game-setup-overlay">
      <div className="game-setup" style={{ width: 'min(1400px, 98vw)', height: 'min(850px, 96vh)' }}>
        {/* Header */}
        <div className="game-setup__header">
          <div className="game-setup__title">SPACE BATTLE</div>
          <div className="game-setup__subtitle">Configure a skirmish — pick species, tech age, and up to {MAX_SHIPS} ships per side</div>
        </div>

        {/* Body — two columns */}
        <div className="game-setup__body" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 0, overflow: 'auto' }}>
          {/* Player side */}
          <SidePanel
            label="PLAYER"
            speciesId={playerSpeciesId}
            onSpeciesChange={setPlayerSpeciesId}
            ships={playerShips}
            availableHulls={availableHulls}
            onAddShip={(h) => addShip('player', h)}
            onRemoveShip={(i) => removeShip('player', i)}
            color={speciesColor(playerSpeciesId)}
          />

          {/* Centre divider with tech age */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
            padding: '28px 20px', borderLeft: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)',
            background: 'rgba(0, 20, 40, 0.4)', minWidth: 200,
          }}>
            <div style={{ fontSize: 13, letterSpacing: '0.2em', color: 'var(--color-text-muted)', marginBottom: 12 }}>TECH AGE</div>
            {AGE_OPTIONS.map(a => (
              <button
                key={a.key}
                onClick={() => handleAgeChange(a.key)}
                style={{
                  display: 'block', width: '100%', padding: '10px 16px', marginBottom: 6,
                  background: techAge === a.key ? 'rgba(0, 212, 255, 0.15)' : 'transparent',
                  border: techAge === a.key ? '1px solid var(--color-accent)' : '1px solid transparent',
                  color: techAge === a.key ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  fontFamily: 'var(--font-mono)', fontSize: 14, letterSpacing: '0.05em',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                {a.label}
              </button>
            ))}

            <div style={{ fontSize: 13, letterSpacing: '0.2em', color: 'var(--color-text-muted)', marginTop: 28, marginBottom: 10 }}>VS</div>
            <div style={{ fontSize: 56, color: 'var(--color-accent)', opacity: 0.3, fontWeight: 'bold' }}>&#x2694;</div>
          </div>

          {/* AI side */}
          <SidePanel
            label="AI OPPONENT"
            speciesId={aiSpeciesId}
            onSpeciesChange={setAiSpeciesId}
            ships={aiShips}
            availableHulls={availableHulls}
            onAddShip={(h) => addShip('ai', h)}
            onRemoveShip={(i) => removeShip('ai', i)}
            color={speciesColor(aiSpeciesId)}
          />
        </div>

        {/* Footer */}
        <div className="game-setup__footer" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 24px', borderTop: '1px solid var(--color-border)', flexShrink: 0,
        }}>
          <button
            onClick={onBack}
            style={{
              background: 'transparent', border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)',
              padding: '10px 24px', fontSize: 14, letterSpacing: '0.1em', cursor: 'pointer',
            }}
          >
            BACK
          </button>
          <div style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
            {playerShips.length} vs {aiShips.length} ships
          </div>
          <button
            onClick={handleStart}
            disabled={!canStart}
            style={{
              background: canStart ? 'rgba(0, 212, 255, 0.15)' : 'rgba(40, 40, 60, 0.3)',
              border: canStart ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
              color: canStart ? 'var(--color-accent)' : 'var(--color-text-muted)',
              fontFamily: 'var(--font-mono)', padding: '10px 32px', fontSize: 16,
              letterSpacing: '0.15em', cursor: canStart ? 'pointer' : 'not-allowed',
              textShadow: canStart ? '0 0 12px rgba(0, 212, 255, 0.5)' : 'none',
            }}
          >
            START BATTLE
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Side panel sub-component ──────────────────────────────────────────────────

interface SidePanelProps {
  label: string;
  speciesId: string;
  onSpeciesChange: (id: string) => void;
  ships: HullClass[];
  availableHulls: Array<{ class: HullClass; name: string; hp: number }>;
  onAddShip: (hull: HullClass) => void;
  onRemoveShip: (idx: number) => void;
  color: string;
}

function SidePanel({ label, speciesId, onSpeciesChange, ships, availableHulls, onAddShip, onRemoveShip, color }: SidePanelProps): React.ReactElement {
  return (
    <div style={{ padding: '24px 28px', overflow: 'auto' }}>
      {/* Side label */}
      <div style={{
        fontSize: 16, letterSpacing: '0.25em', color, marginBottom: 20,
        textShadow: `0 0 12px ${color}40`,
      }}>
        {label}
      </div>

      {/* Species picker */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', letterSpacing: '0.15em', marginBottom: 8 }}>SPECIES</div>
        <select
          value={speciesId}
          onChange={(e) => onSpeciesChange(e.target.value)}
          className="sc-input sc-input--select"
          style={{ width: '100%' }}
        >
          {PREBUILT_SPECIES.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Add ship buttons — immediately below species picker */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', letterSpacing: '0.15em', marginBottom: 8 }}>
          ADD SHIPS ({ships.length}/{MAX_SHIPS})
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {availableHulls.map(h => (
            <button
              key={h.class}
              onClick={() => onAddShip(h.class)}
              disabled={ships.length >= MAX_SHIPS}
              style={{
                background: ships.length >= MAX_SHIPS ? 'rgba(20, 20, 30, 0.3)' : 'rgba(0, 40, 60, 0.5)',
                border: '1px solid var(--color-border)',
                color: ships.length >= MAX_SHIPS ? 'var(--color-text-muted)' : 'var(--color-text)',
                fontFamily: 'var(--font-mono)', fontSize: 13,
                padding: '6px 12px', cursor: ships.length >= MAX_SHIPS ? 'not-allowed' : 'pointer',
                letterSpacing: '0.05em',
              }}
              title={`${h.name} — ${h.hp} HP`}
            >
              + {h.name}
            </button>
          ))}
        </div>
      </div>

      {/* Fleet roster */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', letterSpacing: '0.15em', marginBottom: 8 }}>
          FLEET
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {ships.map((hull, i) => {
            const tmpl = HULL_TEMPLATE_BY_CLASS[hull];
            return (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '7px 12px', background: 'rgba(0, 30, 50, 0.5)',
                border: '1px solid var(--color-border)', fontSize: 14,
              }}>
                <span style={{ color: 'var(--color-text)' }}>
                  {tmpl?.name ?? hull}
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 12, marginLeft: 10 }}>
                    {tmpl?.baseHullPoints ?? '?'} HP
                  </span>
                </span>
                <button
                  onClick={() => onRemoveShip(i)}
                  style={{
                    background: 'transparent', border: 'none', color: '#ff4444',
                    cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 18, padding: '0 6px',
                  }}
                  title="Remove ship"
                >
                  ×
                </button>
              </div>
            );
          })}
          {ships.length === 0 && (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13, fontStyle: 'italic', padding: 6 }}>
              No ships — add at least one
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
