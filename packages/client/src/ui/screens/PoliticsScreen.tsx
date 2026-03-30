/**
 * PoliticsScreen — full-screen overlay showing the empire's political overview.
 *
 * Sections:
 *  - Government Header: government type, legitimacy bar, corruption bar.
 *  - Faction Cards: one card per active faction with support, clout, action, demands.
 *  - Policy Overview: 7 policy domain sliders showing current values.
 *  - Election Panel: next election countdown, last results, rigging controls.
 *  - Revolution Warning: red banner when revolution risk > 0.
 */

import React, { useMemo } from 'react';
import type { GovernmentType } from '@nova-imperia/shared';
import { GOVERNMENTS, tickToDate, tickDurationToString } from '@nova-imperia/shared';

// ---------------------------------------------------------------------------
// Local type definitions — mirrors from shared/types/politics.ts
// The component accepts data via props; engine modules are not imported.
// ---------------------------------------------------------------------------

/** The 7 policy domains that factions care about. */
type PolicyDomain =
  | 'foreign'
  | 'domestic'
  | 'economic'
  | 'political'
  | 'education'
  | 'health'
  | 'security';

/** Escalation actions a faction can take, ordered from mild to extreme. */
type FactionAction = 'lobbying' | 'funding' | 'strikes' | 'protests' | 'coup';

/** A single policy position in an empire. */
interface PolicyPosition {
  domain: PolicyDomain;
  value: number;
  transitionProgress?: number;
  transitionTarget?: number;
}

/** A political faction within an empire. */
interface PoliticalFaction {
  id: string;
  name: string;
  speciesOrigin?: string;
  supportBase: number;
  clout: number;
  satisfaction: number;
  demands: PolicyPosition[];
  currentAction: FactionAction;
  isRulingFaction: boolean;
  foundedTick: number;
  dissolved: boolean;
  supportSources: {
    vocation?: string;
    faith?: string;
    loyalty?: string;
    wealthLevel?: string;
  };
  frustrationTicks?: number;
}

/** Election results for a single election. */
interface ElectionResult {
  tick: number;
  winner: string;
  voteShare: Record<string, number>;
  wasRigged: boolean;
  riggingDetected: boolean;
  turnout: number;
}

/** Election state for an empire. */
interface ElectionState {
  nextElectionTick: number;
  electionInterval: number;
  lastResults?: ElectionResult;
  riggingLevel: number;
  riggingDetectionRisk: number;
}

/** Tracks an active revolution or civil war. */
interface RevolutionState {
  isActive: boolean;
  revoltingFaction?: string;
  militaryStrength: number;
  governmentStrength: number;
  startTick?: number;
  cause?: string;
}

/** The complete political state of an empire at a point in time. */
interface EmpirePoliticalState {
  factions: PoliticalFaction[];
  policies: PolicyPosition[];
  election?: ElectionState;
  revolution?: RevolutionState;
  legitimacy: number;
  corruption: number;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PoliticsScreenProps {
  onClose: () => void;
  /** The empire's current government type. */
  governmentType: GovernmentType;
  /** Full political state for the empire. */
  politicalState: EmpirePoliticalState;
  /** Current game tick. */
  currentTick: number;
  /** Revolution state, if any. */
  revolution?: RevolutionState;
  /** Election state, if the government type supports elections. */
  election?: ElectionState;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Government types that hold elections. */
const ELECTORAL_GOVERNMENTS = new Set<GovernmentType>([
  'democracy', 'republic', 'federation', 'equality',
]);

/** Policy domain display configuration. */
const POLICY_DOMAINS: Array<{
  domain: string;
  label: string;
  lowLabel: string;
  highLabel: string;
}> = [
  { domain: 'foreign',   label: 'Foreign',   lowLabel: 'Isolationist',    highLabel: 'Interventionist' },
  { domain: 'domestic',  label: 'Domestic',  lowLabel: 'Authoritarian',   highLabel: 'Libertarian' },
  { domain: 'economic',  label: 'Economic',  lowLabel: 'Planned Economy', highLabel: 'Free Market' },
  { domain: 'political', label: 'Political', lowLabel: 'Centralised',     highLabel: 'Decentralised' },
  { domain: 'education', label: 'Education', lowLabel: 'Vocational',      highLabel: 'Academic' },
  { domain: 'health',    label: 'Health',    lowLabel: 'Privatised',      highLabel: 'Universal' },
  { domain: 'security',  label: 'Security',  lowLabel: 'Minimal',         highLabel: 'Surveillance State' },
];

/** Colour coding for faction actions on the escalation ladder. */
const ACTION_COLOURS: Record<string, string> = {
  lobbying: '#4caf50',
  funding:  '#ffca28',
  strikes:  '#ff9800',
  protests: '#f44336',
  coup:     '#8b0000',
};

/** Human-readable labels for faction actions. */
const ACTION_LABELS: Record<string, string> = {
  lobbying: 'Lobbying',
  funding:  'Campaign Funding',
  strikes:  'Strikes',
  protests: 'Protests',
  coup:     'Coup Attempt',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Get a colour for legitimacy (green > 70, yellow 40-70, red < 40). */
function legitimacyColour(value: number): string {
  if (value > 70) return '#4caf50';
  if (value >= 40) return '#ffca28';
  return '#f44336';
}

/** Get a colour for corruption (green < 20, yellow 20-50, red > 50). */
function corruptionColour(value: number): string {
  if (value < 20) return '#4caf50';
  if (value <= 50) return '#ffca28';
  return '#f44336';
}

/** Get satisfaction colour (green > 60, yellow 30-60, red < 30). */
function satisfactionColour(value: number): string {
  if (value > 60) return '#4caf50';
  if (value >= 30) return '#ffca28';
  return '#f44336';
}

/** Satisfaction emoji/indicator. */
function satisfactionIndicator(value: number): string {
  if (value > 70) return 'Content';
  if (value > 40) return 'Neutral';
  if (value > 20) return 'Displeased';
  return 'Furious';
}

/** Format a demand into a human-readable summary. */
function formatDemand(demands: PolicyPosition[]): string {
  if (!demands || demands.length === 0) return 'No specific demands';

  // Find the demand with the strongest position (furthest from 50 centre)
  let strongest: PolicyPosition | null = null;
  let maxDelta = 0;
  for (const d of demands) {
    const delta = Math.abs(d.value - 50);
    if (delta > maxDelta) {
      maxDelta = delta;
      strongest = d;
    }
  }
  if (!strongest) return 'No specific demands';

  const cfg = POLICY_DOMAINS.find(p => p.domain === strongest!.domain);
  if (!cfg) return 'No specific demands';

  const direction = strongest.value > 50 ? cfg.highLabel.toLowerCase() : cfg.lowLabel.toLowerCase();
  return `Wants: More ${direction} ${cfg.label.toLowerCase()} policy`;
}

/** Get government display name. */
function governmentName(type: GovernmentType): string {
  const def = GOVERNMENTS[type];
  return def?.name ?? type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Horizontal bar with a label and value. */
function StatBar({
  label,
  value,
  max,
  colour,
  suffix,
}: {
  label: string;
  value: number;
  max: number;
  colour: string;
  suffix?: string;
}): React.ReactElement {
  const width = clamp((value / max) * 100, 0, 100);
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '11px',
        color: 'rgba(208,232,255,0.7)',
        marginBottom: '3px',
      }}>
        <span>{label}</span>
        <span style={{ color: colour }}>{Math.round(value)}{suffix ?? ''}</span>
      </div>
      <div style={{
        height: '8px',
        background: 'rgba(255,255,255,0.08)',
        borderRadius: '4px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${width}%`,
          background: colour,
          borderRadius: '4px',
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );
}

/** A single faction card. */
function FactionCard({
  faction,
}: {
  faction: PoliticalFaction;
}): React.ReactElement {
  const actionColour = ACTION_COLOURS[faction.currentAction] ?? '#999';
  const actionLabel = ACTION_LABELS[faction.currentAction] ?? faction.currentAction;
  const supportPct = typeof faction.supportBase === 'number'
    ? (faction.supportBase > 1 ? faction.supportBase : faction.supportBase * 100)
    : 0;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: faction.isRulingFaction
        ? '1px solid rgba(255,215,0,0.5)'
        : '1px solid rgba(255,255,255,0.08)',
      borderRadius: '6px',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      {/* Header: name + ruling badge */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{
          fontSize: '13px',
          fontWeight: 600,
          color: 'rgba(208,232,255,0.95)',
        }}>
          {faction.name}
        </div>
        {faction.isRulingFaction && (
          <span style={{
            fontSize: '9px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            background: 'rgba(255,215,0,0.2)',
            color: '#ffd700',
            padding: '2px 6px',
            borderRadius: '3px',
          }}>
            Ruling
          </span>
        )}
      </div>

      {/* Support bar */}
      <StatBar
        label="Support"
        value={supportPct}
        max={100}
        colour="#6090ff"
        suffix="%"
      />

      {/* Clout */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '11px',
        color: 'rgba(208,232,255,0.6)',
      }}>
        <span>Clout</span>
        <span style={{ color: 'rgba(208,232,255,0.85)' }}>
          {typeof faction.clout === 'number'
            ? (faction.clout > 1 ? Math.round(faction.clout) : Math.round(faction.clout * 100))
            : 0}
        </span>
      </div>

      {/* Current action */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '11px',
      }}>
        <span style={{ color: 'rgba(208,232,255,0.6)' }}>Action</span>
        <span style={{
          color: actionColour,
          fontWeight: 600,
          fontSize: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.3px',
        }}>
          {actionLabel}
        </span>
      </div>

      {/* Satisfaction */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '11px',
      }}>
        <span style={{ color: 'rgba(208,232,255,0.6)' }}>Satisfaction</span>
        <span style={{
          color: satisfactionColour(faction.satisfaction),
          fontWeight: 500,
        }}>
          {satisfactionIndicator(faction.satisfaction)} ({Math.round(faction.satisfaction)})
        </span>
      </div>

      {/* Key demand */}
      <div style={{
        fontSize: '10px',
        color: 'rgba(208,232,255,0.5)',
        fontStyle: 'italic',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        paddingTop: '6px',
      }}>
        {formatDemand(faction.demands)}
      </div>
    </div>
  );
}

/** Policy slider row. */
function PolicySlider({
  label,
  lowLabel,
  highLabel,
  value,
}: {
  label: string;
  lowLabel: string;
  highLabel: string;
  value: number;
}): React.ReactElement {
  const clamped = clamp(value, 0, 100);
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{
        fontSize: '11px',
        fontWeight: 600,
        color: 'rgba(208,232,255,0.85)',
        marginBottom: '3px',
      }}>
        {label}
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span style={{
          fontSize: '9px',
          color: 'rgba(208,232,255,0.45)',
          width: '80px',
          textAlign: 'right',
          flexShrink: 0,
        }}>
          {lowLabel}
        </span>
        <div style={{
          flex: 1,
          height: '8px',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '4px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Filled portion */}
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${clamped}%`,
            background: 'linear-gradient(90deg, #3070b0, #6090ff)',
            borderRadius: '4px',
            transition: 'width 0.3s ease',
          }} />
          {/* Centre marker */}
          <div style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            width: '1px',
            height: '100%',
            background: 'rgba(255,255,255,0.2)',
          }} />
        </div>
        <span style={{
          fontSize: '9px',
          color: 'rgba(208,232,255,0.45)',
          width: '80px',
          textAlign: 'left',
          flexShrink: 0,
        }}>
          {highLabel}
        </span>
        <span style={{
          fontSize: '10px',
          color: 'rgba(208,232,255,0.6)',
          width: '30px',
          textAlign: 'right',
          flexShrink: 0,
        }}>
          {Math.round(clamped)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PoliticsScreen({
  onClose,
  governmentType,
  politicalState,
  currentTick,
  revolution,
  election,
}: PoliticsScreenProps): React.ReactElement {
  const govDef = GOVERNMENTS[governmentType];
  const govName = govDef?.name ?? governmentName(governmentType);
  const hasElections = ELECTORAL_GOVERNMENTS.has(governmentType);

  // Active (non-dissolved) factions
  const activeFactions = useMemo(
    () => politicalState.factions.filter(f => !f.dissolved),
    [politicalState.factions],
  );

  // Policy positions keyed by domain
  const policyMap = useMemo((): Record<string, number> => {
    const map: Record<string, number> = {};
    for (const p of politicalState.policies) {
      map[p.domain] = p.value;
    }
    return map;
  }, [politicalState.policies]);

  // Election data
  const electionState = election ?? politicalState.election;
  const ticksUntilElection = electionState
    ? Math.max(0, electionState.nextElectionTick - currentTick)
    : 0;

  // Revolution risk — compute from faction states
  const revolutionRisk = useMemo((): number => {
    if (revolution?.isActive) return 100;

    let risk = 0;
    for (const f of activeFactions) {
      if (f.currentAction === 'coup') risk += 40;
      else if (f.currentAction === 'protests') risk += 15;
      else if (f.currentAction === 'strikes') risk += 5;
    }
    // Low legitimacy increases risk
    if (politicalState.legitimacy < 30) risk += 20;
    else if (politicalState.legitimacy < 50) risk += 10;

    // High corruption increases risk
    if (politicalState.corruption > 70) risk += 15;
    else if (politicalState.corruption > 50) risk += 5;

    return clamp(risk, 0, 100);
  }, [activeFactions, politicalState.legitimacy, politicalState.corruption, revolution]);

  // Contributing factors for revolution warning
  const revolutionFactors = useMemo((): string[] => {
    const factors: string[] = [];
    if (revolution?.isActive && revolution.cause) {
      factors.push(revolution.cause);
      return factors;
    }
    for (const f of activeFactions) {
      if (f.currentAction === 'coup') factors.push(`${f.name} is attempting a coup`);
      else if (f.currentAction === 'protests') factors.push(`${f.name} is staging protests`);
      else if (f.currentAction === 'strikes') factors.push(`${f.name} is organising strikes`);
    }
    if (politicalState.legitimacy < 30) factors.push('Dangerously low government legitimacy');
    else if (politicalState.legitimacy < 50) factors.push('Low government legitimacy');
    if (politicalState.corruption > 70) factors.push('Rampant corruption eroding stability');
    else if (politicalState.corruption > 50) factors.push('High corruption fuelling unrest');
    return factors;
  }, [activeFactions, politicalState.legitimacy, politicalState.corruption, revolution]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div
        className="pm-screen"
        style={{ maxWidth: '1100px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="pm-header">
          <div className="pm-header__info">
            <h2 className="pm-header__name">Political Overview</h2>
            <div className="pm-header__type">
              {activeFactions.length} active faction{activeFactions.length !== 1 ? 's' : ''}
              &mdash; {govName}
            </div>
          </div>
          <button
            type="button"
            className="panel-close-btn pm-header__close"
            onClick={onClose}
            aria-label="Close political overview"
          >
            &times;
          </button>
        </div>

        {/* ── Body ── */}
        <div
          className="pm-body"
          style={{
            display: 'grid',
            gridTemplateColumns: '280px 1fr 260px',
            gap: '16px',
            overflow: 'auto',
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* ── Left column: Government + Elections ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Government header */}
            <div>
              <div className="pm-section-label">Government</div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '12px',
              }}>
                {/* Icon placeholder */}
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '6px',
                  background: 'rgba(96,144,255,0.15)',
                  border: '1px solid rgba(96,144,255,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  color: '#6090ff',
                  flexShrink: 0,
                }}>
                  {govName.charAt(0)}
                </div>
                <div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'rgba(208,232,255,0.95)',
                  }}>
                    {govName}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    color: 'rgba(208,232,255,0.45)',
                  }}>
                    {hasElections ? 'Electoral' : 'Non-electoral'} government
                  </div>
                </div>
              </div>

              <StatBar
                label="Legitimacy"
                value={politicalState.legitimacy}
                max={100}
                colour={legitimacyColour(politicalState.legitimacy)}
              />

              <StatBar
                label="Corruption"
                value={politicalState.corruption}
                max={100}
                colour={corruptionColour(politicalState.corruption)}
              />
            </div>

            <div className="pm-divider" />

            {/* Election panel */}
            {hasElections && (
              <div>
                <div className="pm-section-label">Elections</div>

                {electionState ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Next election countdown */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                    }}>
                      <span style={{ color: 'rgba(208,232,255,0.6)' }}>Next election</span>
                      <span style={{ color: 'rgba(208,232,255,0.9)', fontWeight: 500 }}>
                        {ticksUntilElection > 0
                          ? `in ${tickDurationToString(ticksUntilElection)}`
                          : 'Imminent'}
                      </span>
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                    }}>
                      <span style={{ color: 'rgba(208,232,255,0.6)' }}>Election date</span>
                      <span style={{ color: 'rgba(208,232,255,0.7)' }}>
                        {tickToDate(electionState.nextElectionTick)}
                      </span>
                    </div>

                    {/* Last election results */}
                    {electionState.lastResults && (
                      <LastElectionSummary
                        results={electionState.lastResults}
                        factions={activeFactions}
                      />
                    )}

                    {/* Rigging controls placeholder */}
                    <div style={{
                      marginTop: '8px',
                      padding: '8px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px dashed rgba(255,255,255,0.1)',
                      borderRadius: '4px',
                      fontSize: '10px',
                      color: 'rgba(208,232,255,0.3)',
                      textAlign: 'center',
                      fontStyle: 'italic',
                    }}>
                      Intelligence Operations Required
                    </div>
                  </div>
                ) : (
                  <div style={{
                    fontSize: '11px',
                    color: 'rgba(208,232,255,0.5)',
                  }}>
                    No election data available.
                  </div>
                )}
              </div>
            )}

            {!hasElections && (
              <div>
                <div className="pm-section-label">Succession</div>
                <div style={{
                  fontSize: '11px',
                  color: 'rgba(208,232,255,0.5)',
                  fontStyle: 'italic',
                }}>
                  This government type does not hold elections. Power is transferred through
                  {governmentType === 'hive_mind' ? ' the collective consciousness.' :
                   governmentType === 'theocracy' ? ' religious authority.' :
                   governmentType === 'tribal_council' ? ' elder consensus.' :
                   ' force or decree.'}
                </div>
              </div>
            )}

            {/* Policy overview */}
            <div className="pm-divider" />
            <div>
              <div className="pm-section-label">Policy Overview</div>
              {POLICY_DOMAINS.map(cfg => (
                <PolicySlider
                  key={cfg.domain}
                  label={cfg.label}
                  lowLabel={cfg.lowLabel}
                  highLabel={cfg.highLabel}
                  value={policyMap[cfg.domain] ?? 50}
                />
              ))}
            </div>
          </div>

          {/* ── Centre column: Faction cards ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0', overflow: 'hidden' }}>
            <div className="pm-section-label">
              Factions
              <span style={{
                marginLeft: '8px',
                fontSize: '10px',
                color: 'rgba(208,232,255,0.4)',
              }}>
                {activeFactions.length} active
              </span>
            </div>

            {activeFactions.length === 0 ? (
              <div style={{
                color: 'rgba(208,232,255,0.5)',
                fontSize: '12px',
                padding: '12px 0',
              }}>
                No active political factions. The political landscape is dormant.
              </div>
            ) : (
              <div style={{
                flex: 1,
                overflow: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: '10px',
                alignContent: 'start',
                paddingRight: '4px',
              }}>
                {activeFactions.map(faction => (
                  <FactionCard key={faction.id} faction={faction} />
                ))}
              </div>
            )}
          </div>

          {/* ── Right column: Revolution + At a glance ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Stability summary */}
            <div>
              <div className="pm-section-label">Stability</div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                fontSize: '11px',
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: 'rgba(208,232,255,0.6)',
                }}>
                  <span>Ruling faction</span>
                  <span style={{ color: 'rgba(208,232,255,0.9)', fontWeight: 500 }}>
                    {activeFactions.find(f => f.isRulingFaction)?.name ?? 'None'}
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: 'rgba(208,232,255,0.6)',
                }}>
                  <span>Active factions</span>
                  <span style={{ color: 'rgba(208,232,255,0.9)' }}>
                    {activeFactions.length}
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: 'rgba(208,232,255,0.6)',
                }}>
                  <span>Factions protesting</span>
                  <span style={{
                    color: activeFactions.filter(f =>
                      f.currentAction === 'protests' || f.currentAction === 'strikes'
                    ).length > 0 ? '#ff9800' : 'rgba(208,232,255,0.9)',
                  }}>
                    {activeFactions.filter(f =>
                      f.currentAction === 'protests' || f.currentAction === 'strikes'
                    ).length}
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: 'rgba(208,232,255,0.6)',
                }}>
                  <span>Coup attempts</span>
                  <span style={{
                    color: activeFactions.filter(f => f.currentAction === 'coup').length > 0
                      ? '#f44336' : 'rgba(208,232,255,0.9)',
                  }}>
                    {activeFactions.filter(f => f.currentAction === 'coup').length}
                  </span>
                </div>
              </div>
            </div>

            <div className="pm-divider" />

            {/* Faction action breakdown */}
            <div>
              <div className="pm-section-label">Faction Activity</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {(['lobbying', 'funding', 'strikes', 'protests', 'coup'] as const).map(action => {
                  const count = activeFactions.filter(f => f.currentAction === action).length;
                  return (
                    <div
                      key={action}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '10px',
                        padding: '3px 0',
                      }}
                    >
                      <span style={{
                        color: ACTION_COLOURS[action],
                        fontWeight: 500,
                      }}>
                        {ACTION_LABELS[action]}
                      </span>
                      <span style={{
                        color: count > 0 ? 'rgba(208,232,255,0.85)' : 'rgba(208,232,255,0.3)',
                        fontSize: '10px',
                      }}>
                        {count} faction{count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pm-divider" />

            {/* Average satisfaction */}
            <div>
              <div className="pm-section-label">Average Satisfaction</div>
              {activeFactions.length > 0 ? (
                (() => {
                  const avg = activeFactions.reduce((s, f) => s + f.satisfaction, 0) / activeFactions.length;
                  return (
                    <StatBar
                      label=""
                      value={avg}
                      max={100}
                      colour={satisfactionColour(avg)}
                    />
                  );
                })()
              ) : (
                <div style={{ fontSize: '11px', color: 'rgba(208,232,255,0.4)' }}>
                  No faction data
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Revolution Warning Banner ── */}
        {revolutionRisk > 0 && (
          <div style={{
            background: revolution?.isActive
              ? 'rgba(139,0,0,0.35)'
              : 'rgba(244,67,54,0.15)',
            border: revolution?.isActive
              ? '1px solid rgba(139,0,0,0.6)'
              : '1px solid rgba(244,67,54,0.3)',
            borderRadius: '6px',
            padding: '12px 16px',
            margin: '0 16px 16px 16px',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: revolutionFactors.length > 0 ? '8px' : '0',
            }}>
              <span style={{
                fontSize: '13px',
                fontWeight: 700,
                color: revolution?.isActive ? '#ff4444' : '#f44336',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                {revolution?.isActive ? 'Revolution in Progress' : 'Revolution Risk'}
              </span>
              <span style={{
                fontSize: '14px',
                fontWeight: 700,
                color: revolution?.isActive ? '#ff4444' : '#f44336',
              }}>
                {Math.round(revolutionRisk)}%
              </span>
            </div>

            {revolutionFactors.length > 0 && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
              }}>
                {revolutionFactors.map((factor, idx) => (
                  <div
                    key={idx}
                    style={{
                      fontSize: '10px',
                      color: 'rgba(244,147,140,0.85)',
                      paddingLeft: '10px',
                      position: 'relative',
                    }}
                  >
                    <span style={{
                      position: 'absolute',
                      left: 0,
                      color: 'rgba(244,67,54,0.6)',
                    }}>
                      &bull;
                    </span>
                    {factor}
                  </div>
                ))}
              </div>
            )}

            {revolution?.isActive && (
              <div style={{
                marginTop: '8px',
                paddingTop: '8px',
                borderTop: '1px solid rgba(244,67,54,0.2)',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '10px',
                color: 'rgba(208,232,255,0.6)',
              }}>
                <span>
                  Rebel strength: {Math.round(revolution.militaryStrength)}
                </span>
                <span>
                  Government strength: {Math.round(revolution.governmentStrength)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Last election summary sub-component
// ---------------------------------------------------------------------------

function LastElectionSummary({
  results,
  factions,
}: {
  results: ElectionResult;
  factions: PoliticalFaction[];
}): React.ReactElement {
  // Sort vote shares descending
  const sortedShares = Object.entries(results.voteShare)
    .sort(([, a], [, b]) => b - a);

  return (
    <div style={{
      marginTop: '8px',
      padding: '8px',
      background: 'rgba(255,255,255,0.03)',
      borderRadius: '4px',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{
        fontSize: '10px',
        fontWeight: 600,
        color: 'rgba(208,232,255,0.6)',
        marginBottom: '6px',
        textTransform: 'uppercase',
        letterSpacing: '0.3px',
      }}>
        Last Election &mdash; {tickToDate(results.tick)}
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '10px',
        color: 'rgba(208,232,255,0.5)',
        marginBottom: '6px',
      }}>
        <span>Turnout: {Math.round(results.turnout)}%</span>
        {results.riggingDetected && (
          <span style={{ color: '#f44336', fontWeight: 600 }}>Rigging detected!</span>
        )}
      </div>

      {sortedShares.map(([factionId, share]) => {
        const factionName = factions.find(f => f.id === factionId)?.name ?? factionId;
        const isWinner = factionId === results.winner;
        return (
          <div
            key={factionId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '3px',
            }}
          >
            <span style={{
              fontSize: '10px',
              color: isWinner ? '#ffd700' : 'rgba(208,232,255,0.6)',
              fontWeight: isWinner ? 600 : 400,
              width: '80px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}>
              {factionName}
            </span>
            <div style={{
              flex: 1,
              height: '5px',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: '3px',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${clamp(share, 0, 100)}%`,
                background: isWinner ? '#ffd700' : '#6090ff',
                borderRadius: '3px',
              }} />
            </div>
            <span style={{
              fontSize: '10px',
              color: isWinner ? '#ffd700' : 'rgba(208,232,255,0.6)',
              width: '30px',
              textAlign: 'right',
              flexShrink: 0,
            }}>
              {Math.round(share)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
