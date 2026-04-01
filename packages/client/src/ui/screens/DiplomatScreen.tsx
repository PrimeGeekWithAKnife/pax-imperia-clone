/**
 * DiplomatScreen -- full-screen overlay for managing diplomat characters.
 *
 * Displays a table of all player diplomats with skills, status, and traits.
 * A detail panel shows the selected diplomat's full profile including loyalty
 * bar, experience, personal agenda, meeting summary, and compromised warnings.
 *
 * Actions: assign a diplomat to a known empire, or recall them home.
 *
 * Data source: `diplomats` array on the engine tick state (added post-v0.3.0).
 * Falls back to generating mock diplomats via `generateDiplomat()` when no
 * real data exists yet (old saves or pre-diplomat game starts).
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { Empire } from '@nova-imperia/shared';
import { generateDiplomat, assignDiplomat } from '@nova-imperia/shared';
import { getGameEngine } from '../../engine/GameEngine';

// ---------------------------------------------------------------------------
// Local type mirrors -- Diplomat and DiplomatTrait are defined in
// packages/shared/src/types/diplomacy.ts but not re-exported from the
// shared barrel.  Mirror the shapes here to avoid reaching into internals.
// ---------------------------------------------------------------------------

type DiplomatTrait =
  | 'honest'
  | 'deceptive'
  | 'aggressive'
  | 'conciliatory'
  | 'xenophile'
  | 'xenophobe'
  | 'corrupt'
  | 'incorruptible';

interface Diplomat {
  id: string;
  name: string;
  speciesId: string;
  empireId: string;
  negotiationSkill: number;
  perceptionSkill: number;
  charisma: number;
  loyalty: number;
  experience: number;
  traits: DiplomatTrait[];
  assignedRelationship?: string;
  personalAgenda?: string;
  isCompromised: boolean;
  compromisedBy?: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DiplomatScreenProps {
  onClose: () => void;
  playerEmpire: Empire;
  knownEmpires: Empire[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRAIT_LABELS: Record<DiplomatTrait, { label: string; colour: string }> = {
  honest:         { label: 'Honest',         colour: '#88ffcc' },
  deceptive:      { label: 'Deceptive',      colour: '#ff7777' },
  aggressive:     { label: 'Aggressive',     colour: '#ff9944' },
  conciliatory:   { label: 'Conciliatory',   colour: '#77ccff' },
  xenophile:      { label: 'Xenophile',      colour: '#aa88ff' },
  xenophobe:      { label: 'Xenophobe',      colour: '#ff6688' },
  corrupt:        { label: 'Corrupt',        colour: '#ff5555' },
  incorruptible:  { label: 'Incorruptible',  colour: '#44ffaa' },
};

const STATUS_COLOURS: Record<string, string> = {
  active:      '#88ffcc',
  idle:        '#6688aa',
  compromised: '#ff4444',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive a short status string from a diplomat's current state. */
function getDiplomatStatus(d: Diplomat): 'active' | 'idle' | 'compromised' {
  if (d.isCompromised) return 'compromised';
  if (d.assignedRelationship) return 'active';
  return 'idle';
}

/** Calculate the number of turns served (experience / 1 XP per tick). */
function turnsServed(d: Diplomat): number {
  return d.experience;
}

/** Loyalty bar colour: green above 60, amber 30-60, red below 30. */
function loyaltyColour(loyalty: number): string {
  if (loyalty >= 60) return '#10b981';
  if (loyalty >= 30) return '#f59e0b';
  return '#ef4444';
}

/**
 * Read the diplomats array from the engine tick state.
 *
 * The `diplomats` field is not on the official GameTickState interface -- it
 * is attached dynamically by the game loop (see game-loop.ts
 * stepDiplomatCharacters).  Access it via a cast.
 */
function readDiplomatsFromEngine(playerEmpireId: string): Diplomat[] | null {
  const engine = getGameEngine();
  if (!engine) return null;

  const state = engine.getState() as unknown as Record<string, unknown>;
  const allDiplomats = state.diplomats as Diplomat[] | undefined;
  if (!allDiplomats || allDiplomats.length === 0) return null;

  // Filter to the player's diplomats only
  return allDiplomats.filter(d => d.empireId === playerEmpireId);
}

/**
 * Generate mock diplomats for display when the engine has no real data.
 *
 * TODO: Remove mock generation once diplomat creation is wired into
 * colony/building actions (e.g. Diplomatic Academy produces diplomats).
 */
function generateMockDiplomats(playerEmpire: Empire): Diplomat[] {
  const speciesId = playerEmpire.species?.id ?? 'teranos';
  const empireId = playerEmpire.id;
  const diplomacyTrait = playerEmpire.species?.traits?.diplomacy ?? 5;

  // Seeded pseudo-random for stable mock data within a session
  let seed = 42;
  const rng = (): number => {
    seed = (seed * 16807 + 0) % 2147483647;
    return seed / 2147483647;
  };

  const mocks: Diplomat[] = [];
  for (let i = 0; i < 4; i++) {
    const d = generateDiplomat(speciesId, empireId, diplomacyTrait, i % 3, rng) as unknown as Diplomat;
    mocks.push(d);
  }

  // Assign the first mock to a fake relationship for variety
  if (mocks.length > 0) {
    mocks[0] = { ...mocks[0], assignedRelationship: 'mock-empire' } as Diplomat;
  }

  return mocks;
}

// ---------------------------------------------------------------------------
// Sub-component: Skill badge
// ---------------------------------------------------------------------------

function SkillBadge({ label, value }: { label: string; value: number }): React.ReactElement {
  const intensity = Math.min(1, value / 10);
  const colour = `rgba(0, 212, 255, ${0.3 + intensity * 0.7})`;
  return (
    <span
      className="diplomat-skill-badge"
      style={{ color: colour, borderColor: colour }}
      title={`${label}: ${value}/10`}
    >
      {label.charAt(0).toUpperCase()}:{value}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Loyalty bar
// ---------------------------------------------------------------------------

function LoyaltyBar({ loyalty }: { loyalty: number }): React.ReactElement {
  const pct = Math.max(0, Math.min(100, loyalty));
  const colour = loyaltyColour(pct);
  return (
    <div className="diplomat-loyalty-bar">
      <div className="diplomat-loyalty-bar__label">
        Loyalty: <span style={{ color: colour }}>{Math.round(pct)}%</span>
      </div>
      <div className="diplomat-loyalty-bar__track">
        <div
          className="diplomat-loyalty-bar__fill"
          style={{ width: `${pct}%`, background: colour }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Trait chip
// ---------------------------------------------------------------------------

function TraitChip({ trait }: { trait: DiplomatTrait }): React.ReactElement {
  const info = TRAIT_LABELS[trait] ?? { label: trait, colour: '#999' };
  return (
    <span
      className="diplomat-trait-chip"
      style={{ color: info.colour, borderColor: info.colour }}
    >
      {info.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DiplomatScreen({
  onClose,
  playerEmpire,
  knownEmpires,
}: DiplomatScreenProps): React.ReactElement {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<string>('');

  // ── Load diplomat data ─────────────────────────────────────────────────────
  const [diplomats, setDiplomats] = useState<Diplomat[]>([]);
  const [isMockData, setIsMockData] = useState(false);

  useEffect(() => {
    const real = readDiplomatsFromEngine(playerEmpire.id);
    if (real && real.length > 0) {
      setDiplomats(real);
      setIsMockData(false);
    } else {
      setDiplomats(generateMockDiplomats(playerEmpire));
      setIsMockData(true);
    }
  }, [playerEmpire]);

  // ── Resolve empire names ───────────────────────────────────────────────────
  const empireNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of knownEmpires) {
      map.set(e.id, e.name);
    }
    map.set(playerEmpire.id, playerEmpire.name);
    map.set('mock-empire', 'Unknown Empire');
    return map;
  }, [knownEmpires, playerEmpire]);

  // ── Selected diplomat ──────────────────────────────────────────────────────
  const selected = useMemo(
    () => diplomats.find(d => d.id === selectedId) ?? null,
    [diplomats, selectedId],
  );

  // Auto-select first diplomat if none selected
  useEffect(() => {
    if (!selectedId && diplomats.length > 0) {
      setSelectedId(diplomats[0].id);
    }
  }, [selectedId, diplomats]);

  // ── Assign diplomat to empire ──────────────────────────────────────────────
  const handleAssign = useCallback(() => {
    if (!selected || !assignTarget) return;

    const updated = assignDiplomat(selected, assignTarget) as unknown as Diplomat;
    setDiplomats(prev =>
      prev.map(d => (d.id === updated.id ? updated : d)),
    );
    setAssignTarget('');
  }, [selected, assignTarget]);

  // ── Recall diplomat ────────────────────────────────────────────────────────
  const handleRecall = useCallback(() => {
    if (!selected) return;

    const recalled: Diplomat = {
      ...selected,
      traits: [...selected.traits],
      assignedRelationship: undefined,
    };
    setDiplomats(prev =>
      prev.map(d => (d.id === recalled.id ? recalled : d)),
    );
  }, [selected]);

  // ── Close on Escape ────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // ── Available empires for assignment dropdown ──────────────────────────────
  const assignableEmpires = useMemo(
    () => knownEmpires.filter(e => e.id !== playerEmpire.id),
    [knownEmpires, playerEmpire.id],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="pm-overlay" onClick={onClose}>
      <div
        className="pm-screen diplomat-screen"
        style={{ maxWidth: '1100px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* -- Header -- */}
        <div className="pm-header">
          <div className="pm-header__info">
            <h2 className="pm-header__name">Diplomat Corps</h2>
            <div className="pm-header__type">
              {diplomats.length} diplomat{diplomats.length !== 1 ? 's' : ''}
              {isMockData && (
                <span style={{ color: '#f59e0b', marginLeft: '8px', fontSize: '0.85em' }}>
                  (simulated data)
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            className="panel-close-btn pm-header__close"
            onClick={onClose}
            aria-label="Close diplomat screen"
          >
            &times;
          </button>
        </div>

        {/* -- Body: two columns -- */}
        <div
          className="pm-body"
          style={{ gridTemplateColumns: '1fr 340px', overflow: 'hidden' }}
        >

          {/* -- Left column: Diplomat table -- */}
          <div className="pm-col pm-col--info" style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            <div className="pm-section-label">Diplomats</div>

            {/* Table header */}
            <div className="diplomat-table-header">
              <span className="diplomat-col-name">Name</span>
              <span className="diplomat-col-assigned">Assigned To</span>
              <span className="diplomat-col-skills">Skills</span>
              <span className="diplomat-col-status">Status</span>
            </div>

            {/* Scrollable table body */}
            <div className="diplomat-table-body" style={{ overflowY: 'auto', flex: 1 }}>
              {diplomats.length === 0 ? (
                <div style={{ padding: '16px', color: '#6688aa', textAlign: 'center' }}>
                  No diplomats available. Build a Diplomatic Academy to recruit.
                </div>
              ) : (
                diplomats.map(d => {
                  const status = getDiplomatStatus(d);
                  const isSelected = d.id === selectedId;
                  const assignedName = d.assignedRelationship
                    ? empireNameMap.get(d.assignedRelationship) ?? 'Unknown'
                    : '--';

                  return (
                    <div
                      key={d.id}
                      className={`diplomat-table-row${isSelected ? ' diplomat-table-row--selected' : ''}`}
                      onClick={() => setSelectedId(d.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') setSelectedId(d.id); }}
                    >
                      <span className="diplomat-col-name" title={d.name}>{d.name}</span>
                      <span className="diplomat-col-assigned" title={assignedName}>{assignedName}</span>
                      <span className="diplomat-col-skills">
                        <SkillBadge label="Negotiation" value={d.negotiationSkill} />
                        <SkillBadge label="Perception" value={d.perceptionSkill} />
                        <SkillBadge label="Charisma" value={d.charisma} />
                      </span>
                      <span
                        className="diplomat-col-status"
                        style={{ color: STATUS_COLOURS[status] ?? '#6688aa' }}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* -- Right column: Detail panel -- */}
          <div
            className="pm-col pm-col--actions"
            style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px' }}
          >
            {selected ? (
              <>
                {/* Name + species */}
                <div>
                  <h3 style={{ margin: 0, color: '#e8e8e8', fontSize: '1.1em' }}>{selected.name}</h3>
                  <div style={{ color: '#8899aa', fontSize: '0.85em', marginTop: '2px' }}>
                    Species: {selected.speciesId}
                  </div>
                </div>

                {/* Compromised warning */}
                {selected.isCompromised && (
                  <div
                    className="diplomat-warning"
                    style={{
                      background: 'rgba(255, 60, 60, 0.15)',
                      border: '1px solid #ff4444',
                      borderRadius: '4px',
                      padding: '8px 10px',
                      color: '#ff6666',
                      fontSize: '0.85em',
                    }}
                  >
                    COMPROMISED -- This diplomat has been turned by
                    {selected.compromisedBy
                      ? ` ${empireNameMap.get(selected.compromisedBy) ?? 'an unknown empire'}`
                      : ' an enemy empire'}.
                    Intelligence may be unreliable.
                  </div>
                )}

                {/* Skills detail */}
                <div>
                  <div className="pm-section-label" style={{ marginBottom: '4px' }}>Skills</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <SkillBadge label="Negotiation" value={selected.negotiationSkill} />
                    <SkillBadge label="Perception" value={selected.perceptionSkill} />
                    <SkillBadge label="Charisma" value={selected.charisma} />
                  </div>
                </div>

                {/* Traits */}
                <div>
                  <div className="pm-section-label" style={{ marginBottom: '4px' }}>Traits</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {selected.traits.map(t => (
                      <TraitChip key={t} trait={t} />
                    ))}
                  </div>
                </div>

                {/* Loyalty */}
                <LoyaltyBar loyalty={selected.loyalty} />

                {/* Experience / turns */}
                <div>
                  <div className="pm-section-label" style={{ marginBottom: '4px' }}>Experience</div>
                  <div style={{ color: '#b0c0d0', fontSize: '0.9em' }}>
                    {selected.experience} XP &middot; {turnsServed(selected)} turns served
                  </div>
                </div>

                {/* Personal agenda */}
                {selected.personalAgenda && (
                  <div>
                    <div className="pm-section-label" style={{ marginBottom: '4px' }}>Personal Agenda</div>
                    <div style={{ color: '#f59e0b', fontSize: '0.85em', fontStyle: 'italic' }}>
                      {selected.personalAgenda}
                    </div>
                  </div>
                )}

                {/* Assignment */}
                <div>
                  <div className="pm-section-label" style={{ marginBottom: '4px' }}>Assignment</div>
                  {selected.assignedRelationship ? (
                    <div style={{ color: '#88ffcc', fontSize: '0.9em' }}>
                      Assigned to: {empireNameMap.get(selected.assignedRelationship) ?? 'Unknown'}
                    </div>
                  ) : (
                    <div style={{ color: '#6688aa', fontSize: '0.9em' }}>Idle -- not assigned</div>
                  )}
                </div>

                <div className="pm-divider" />

                {/* Actions */}
                <div>
                  <div className="pm-section-label" style={{ marginBottom: '6px' }}>Actions</div>

                  {/* Assign to Empire */}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', alignItems: 'center' }}>
                    <select
                      value={assignTarget}
                      onChange={(e) => setAssignTarget(e.target.value)}
                      className="diplomat-select"
                      style={{
                        flex: 1,
                        background: '#1a2233',
                        color: '#c0d0e0',
                        border: '1px solid #334455',
                        borderRadius: '4px',
                        padding: '6px 8px',
                        fontSize: '0.85em',
                      }}
                    >
                      <option value="">Assign to Empire...</option>
                      {assignableEmpires.map(e => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="pm-build-btn"
                      onClick={handleAssign}
                      disabled={!assignTarget}
                      style={{ padding: '6px 12px', fontSize: '0.85em' }}
                    >
                      Assign
                    </button>
                  </div>

                  {/* Recall button */}
                  {selected.assignedRelationship && (
                    <button
                      type="button"
                      className="pm-build-btn"
                      onClick={handleRecall}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.85em',
                        background: 'rgba(255, 120, 60, 0.15)',
                        borderColor: '#ff7744',
                        color: '#ff9966',
                      }}
                    >
                      Recall Diplomat
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div style={{ color: '#6688aa', textAlign: 'center', padding: '40px 16px' }}>
                Select a diplomat to view details
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
