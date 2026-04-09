/**
 * SkirmishSetupScreen — pre-battle setup for the Space Battle (skirmish) mode.
 *
 * Two columns: Player side and AI side.
 * Each side picks a species, a tech age, and up to 9 ships from available hull classes.
 * Hit "Start Battle" to launch directly into CombatScene.
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { Species, HullClass, TechAge, BattlefieldSize, CrewExperienceLevel } from '@nova-imperia/shared';
import {
  PREBUILT_SPECIES,
  HULL_TEMPLATES,
  SHIP_COMPONENTS,
  generateDefaultDesigns,
  getAvailableComponents,
  generateId,
  HULL_TEMPLATE_BY_CLASS,
  TECH_AGES,
  BATTLEFIELD_SIZE_CONFIG,
  EXPERIENCE_LEVELS,
} from '@nova-imperia/shared';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SkirmishConfig {
  playerSpecies: Species;
  aiSpecies: Species;
  playerShips: HullClass[];
  aiShips: HullClass[];
  techAge: TechAge;
  battlefieldSize: BattlefieldSize;
  playerCrewExperience: CrewExperienceLevel;
  aiCrewExperience: CrewExperienceLevel;
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

const MAP_SIZE_OPTIONS: Array<{ key: BattlefieldSize; label: string }> = [
  { key: 'small', label: 'Small (9 per side)' },
  { key: 'medium', label: 'Medium (18 per side)' },
  { key: 'large', label: 'Large (36 per side)' },
];

const CREW_EXP_OPTIONS: Array<{ key: CrewExperienceLevel; label: string }> = EXPERIENCE_LEVELS.map(e => ({
  key: e,
  label: e.charAt(0).toUpperCase() + e.slice(1),
}));

/** Hull classes available at or before the given tech age. */
function getAvailableHulls(age: TechAge): Array<{ class: HullClass; name: string; hp: number }> {
  const ageIdx = TECH_AGES.findIndex(a => a.name === age);
  return HULL_TEMPLATES
    .filter(h => {
      const hullAgeIdx = TECH_AGES.findIndex(a => a.name === h.requiredAge);
      return hullAgeIdx <= ageIdx && !h.class.startsWith('coloniser') && h.class !== 'science_probe' && h.class !== 'spy_probe';
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
  const [battlefieldSize, setBattlefieldSize] = useState<BattlefieldSize>('small');
  const [playerShips, setPlayerShips] = useState<HullClass[]>(['patrol', 'destroyer']);
  const [aiShips, setAiShips] = useState<HullClass[]>(['patrol', 'destroyer']);
  const [playerCrewExp, setPlayerCrewExp] = useState<CrewExperienceLevel>('regular');
  const [aiCrewExp, setAiCrewExp] = useState<CrewExperienceLevel>('regular');

  const maxShips = BATTLEFIELD_SIZE_CONFIG[battlefieldSize].maxShipsPerSide;

  const availableHulls = useMemo(() => getAvailableHulls(techAge), [techAge]);
  const playerSpecies = useMemo(() => PREBUILT_SPECIES.find(s => s.id === playerSpeciesId) ?? PREBUILT_SPECIES[0], [playerSpeciesId]);
  const aiSpecies = useMemo(() => PREBUILT_SPECIES.find(s => s.id === aiSpeciesId) ?? PREBUILT_SPECIES[1], [aiSpeciesId]);

  const addShip = useCallback((side: 'player' | 'ai', hull: HullClass) => {
    const setter = side === 'player' ? setPlayerShips : setAiShips;
    setter(prev => prev.length >= maxShips ? prev : [...prev, hull]);
  }, [maxShips]);

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
      battlefieldSize,
      playerCrewExperience: playerCrewExp,
      aiCrewExperience: aiCrewExp,
    });
  }, [playerSpecies, aiSpecies, playerShips, aiShips, techAge, battlefieldSize, playerCrewExp, aiCrewExp, onStartBattle]);

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
      <div className="game-setup" style={{ width: 'min(1200px, 96vw)', height: 'min(720px, 92vh)' }}>
        {/* Header */}
        <div className="game-setup__header">
          <div className="game-setup__title">SPACE BATTLE</div>
          <div className="game-setup__subtitle">Configure a skirmish — pick species, tech age, map size, and up to {maxShips} ships per side</div>
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
            maxShips={maxShips}
          />

          {/* Centre divider with tech age */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
            padding: '24px 16px', borderLeft: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)',
            background: 'rgba(0, 20, 40, 0.4)', minWidth: 180,
          }}>
            <div style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--color-text-muted)', marginBottom: 8 }}>TECH AGE</div>
            {AGE_OPTIONS.map(a => (
              <button
                key={a.key}
                onClick={() => handleAgeChange(a.key)}
                style={{
                  display: 'block', width: '100%', padding: '8px 12px', marginBottom: 4,
                  background: techAge === a.key ? 'rgba(0, 212, 255, 0.15)' : 'transparent',
                  border: techAge === a.key ? '1px solid var(--color-accent)' : '1px solid transparent',
                  color: techAge === a.key ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.05em',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                {a.label}
              </button>
            ))}

            <div style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--color-text-muted)', marginTop: 24, marginBottom: 8 }}>MAP SIZE</div>
            {MAP_SIZE_OPTIONS.map(m => (
              <button
                key={m.key}
                onClick={() => setBattlefieldSize(m.key)}
                style={{
                  display: 'block', width: '100%', padding: '8px 12px', marginBottom: 4,
                  background: battlefieldSize === m.key ? 'rgba(0, 212, 255, 0.15)' : 'transparent',
                  border: battlefieldSize === m.key ? '1px solid var(--color-accent)' : '1px solid transparent',
                  color: battlefieldSize === m.key ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.05em',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                {m.label}
              </button>
            ))}

            <div style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--color-text-muted)', marginTop: 24, marginBottom: 8 }}>PLAYER CREW</div>
            <select
              value={playerCrewExp}
              onChange={(e) => setPlayerCrewExp(e.target.value as CrewExperienceLevel)}
              className="sc-input sc-input--select"
              style={{ width: '100%', marginBottom: 8, fontSize: 11 }}
            >
              {CREW_EXP_OPTIONS.map(c => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>

            <div style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--color-text-muted)', marginTop: 12, marginBottom: 8 }}>AI CREW</div>
            <select
              value={aiCrewExp}
              onChange={(e) => setAiCrewExp(e.target.value as CrewExperienceLevel)}
              className="sc-input sc-input--select"
              style={{ width: '100%', marginBottom: 8, fontSize: 11 }}
            >
              {CREW_EXP_OPTIONS.map(c => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>

            <div style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--color-text-muted)', marginTop: 24, marginBottom: 8 }}>VS</div>
            <div style={{ fontSize: 48, color: 'var(--color-accent)', opacity: 0.3, fontWeight: 'bold' }}>&#x2694;</div>
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
            maxShips={maxShips}
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
              padding: '8px 20px', fontSize: 12, letterSpacing: '0.1em', cursor: 'pointer',
            }}
          >
            BACK
          </button>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            {playerShips.length} vs {aiShips.length} ships
          </div>
          <button
            onClick={handleStart}
            disabled={!canStart}
            style={{
              background: canStart ? 'rgba(0, 212, 255, 0.15)' : 'rgba(40, 40, 60, 0.3)',
              border: canStart ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
              color: canStart ? 'var(--color-accent)' : 'var(--color-text-muted)',
              fontFamily: 'var(--font-mono)', padding: '8px 28px', fontSize: 14,
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
  maxShips: number;
}

function SidePanel({ label, speciesId, onSpeciesChange, ships, availableHulls, onAddShip, onRemoveShip, color, maxShips }: SidePanelProps): React.ReactElement {
  return (
    <div style={{ padding: '20px 24px', overflow: 'auto' }}>
      {/* Side label */}
      <div style={{
        fontSize: 12, letterSpacing: '0.25em', color, marginBottom: 16,
        textShadow: `0 0 10px ${color}40`,
      }}>
        {label}
      </div>

      {/* Species picker */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: '0.15em', marginBottom: 6 }}>SPECIES</div>
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
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: '0.15em', marginBottom: 6 }}>
          ADD SHIPS ({ships.length}/{maxShips})
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
          {availableHulls.map(h => (
            <button
              key={h.class}
              onClick={() => onAddShip(h.class)}
              disabled={ships.length >= maxShips}
              style={{
                background: ships.length >= maxShips ? 'rgba(20, 20, 30, 0.3)' : 'rgba(0, 40, 60, 0.5)',
                border: '1px solid var(--color-border)',
                color: ships.length >= maxShips ? 'var(--color-text-muted)' : 'var(--color-text)',
                fontFamily: 'var(--font-mono)', fontSize: 10,
                padding: '4px 8px', cursor: ships.length >= maxShips ? 'not-allowed' : 'pointer',
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
        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: '0.15em', marginBottom: 6 }}>
          FLEET
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {ships.map((hull, i) => {
            const tmpl = HULL_TEMPLATE_BY_CLASS[hull];
            return (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '5px 10px', background: 'rgba(0, 30, 50, 0.5)',
                border: '1px solid var(--color-border)', fontSize: 12,
              }}>
                <span style={{ color: 'var(--color-text)' }}>
                  {tmpl?.name ?? hull}
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 10, marginLeft: 8 }}>
                    {tmpl?.baseHullPoints ?? '?'} HP
                  </span>
                </span>
                <button
                  onClick={() => onRemoveShip(i)}
                  style={{
                    background: 'transparent', border: 'none', color: '#ff4444',
                    cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 14, padding: '0 4px',
                  }}
                  title="Remove ship"
                >
                  ×
                </button>
              </div>
            );
          })}
          {ships.length === 0 && (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 11, fontStyle: 'italic', padding: 4 }}>
              No ships — add at least one
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
