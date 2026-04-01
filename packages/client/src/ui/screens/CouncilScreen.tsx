/**
 * CouncilScreen -- full-screen overlay showing galactic organisations.
 *
 * Sections:
 *  1. Organisation panel -- the org the player belongs to, or "Not a member" info.
 *  2. Member table -- empire name, voting power %, membership status.
 *  3. Resolutions list -- active/past resolutions with status badges.
 *  4. Empty state -- shown when no organisations exist yet.
 *
 * Data is read from the engine tick state's `organisationState` field,
 * which is dynamically attached by the game loop (not a formal
 * GameTickState property).  Gracefully handles missing data (old saves).
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { Empire } from '@nova-imperia/shared';
import { getGameEngine } from '../../engine/GameEngine';
import { useGameEvent } from '../hooks/useGameEvents';

// ---------------------------------------------------------------------------
// Local type mirrors (not re-exported from the shared barrel)
// ---------------------------------------------------------------------------

type ResolutionType = 'advisory' | 'binding';
type VoteChoice = 'for' | 'against' | 'abstain';

interface CouncilResolution {
  id: string;
  proposedBy: string;
  title: string;
  description: string;
  type: ResolutionType;
  votes: Record<string, VoteChoice>;
  passed: boolean;
  tick: number;
}

interface GalacticOrganisation {
  id: string;
  name: string;
  formedTick: number;
  founderEmpires: [string, string];
  memberEmpires: string[];
  votingPower: Record<string, number>;
  resolutions: CouncilResolution[];
  reserveCurrency: boolean;
  hasOwnMarket: boolean;
  maturityTick: number;
}

interface GalacticOrganisationState {
  organisations: GalacticOrganisation[];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CouncilScreenProps {
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-GB', { maximumFractionDigits: 0 });
}

/** Determine whether a resolution is still open for voting. */
function isVotingOpen(
  resolution: CouncilResolution,
  org: GalacticOrganisation,
): boolean {
  // All members have voted -> resolved.
  const allVoted = org.memberEmpires.every(
    (id) => resolution.votes[id] !== undefined,
  );
  if (allVoted) return false;

  // Check if it was already resolved (passed is set after resolveVote).
  // A resolution with no votes and passed === false could be brand-new,
  // so we check vote count instead.
  const voteCount = Object.keys(resolution.votes).length;
  if (voteCount > 0 && resolution.passed) return false;

  return true;
}

type ResolutionStatus = 'VOTING' | 'PASSED' | 'FAILED';

function getResolutionStatus(
  resolution: CouncilResolution,
  org: GalacticOrganisation,
): ResolutionStatus {
  if (isVotingOpen(resolution, org)) return 'VOTING';
  return resolution.passed ? 'PASSED' : 'FAILED';
}

const STATUS_COLOURS: Record<ResolutionStatus, string> = {
  PASSED: '#10b981',
  VOTING: '#f59e0b',
  FAILED: '#ef4444',
};

type MemberStatus = 'Founding' | 'Member';

function getMemberStatus(
  empireId: string,
  org: GalacticOrganisation,
): MemberStatus {
  return org.founderEmpires.includes(empireId) ? 'Founding' : 'Member';
}

/** Look up an empire by ID from the full empires list. */
function getEmpireName(empireId: string, empires: Empire[]): string {
  const empire = empires.find((e) => e.id === empireId);
  return empire?.name ?? empireId;
}

/** Calculate the total voting power in the organisation for percentage display. */
function totalVotingPower(org: GalacticOrganisation): number {
  return Object.values(org.votingPower).reduce((sum, v) => sum + v, 0);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: ResolutionStatus }): React.ReactElement {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 8px',
        borderRadius: '3px',
        fontSize: '10px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        background: `${STATUS_COLOURS[status]}22`,
        color: STATUS_COLOURS[status],
        border: `1px solid ${STATUS_COLOURS[status]}44`,
      }}
    >
      {status}
    </span>
  );
}

function MemberStatusBadge({ status }: { status: MemberStatus }): React.ReactElement {
  const colour = status === 'Founding' ? '#a78bfa' : '#6b7280';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 6px',
        borderRadius: '3px',
        fontSize: '10px',
        fontWeight: 500,
        background: `${colour}22`,
        color: colour,
        border: `1px solid ${colour}44`,
      }}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CouncilScreen({ onClose }: CouncilScreenProps): React.ReactElement {
  // Escape key closes the screen
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Re-render on engine ticks so data stays current
  const [, setTickCounter] = useState(0);
  useGameEvent(
    'engine:tick',
    useCallback(() => {
      setTickCounter((prev) => prev + 1);
    }, []),
  );

  // ---------------------------------------------------------------------------
  // Data extraction
  // ---------------------------------------------------------------------------

  const engine = getGameEngine();
  const tickState = engine?.getState();
  const empires = tickState?.gameState.empires ?? [];
  const currentTick = tickState?.gameState.currentTick ?? 0;

  // organisationState is dynamically attached (not a formal GameTickState field)
  const organisationState = tickState
    ? ((tickState as unknown as Record<string, unknown>).organisationState as
        | GalacticOrganisationState
        | undefined)
    : undefined;

  const organisations = organisationState?.organisations ?? [];

  // Player empire
  const playerEmpire = empires.find((e) => !e.isAI) ?? empires[0] ?? null;
  const playerId = playerEmpire?.id ?? '';

  // Find the player's organisation (an empire can belong to at most one)
  const playerOrg = useMemo(
    () => organisations.find((org) => org.memberEmpires.includes(playerId)) ?? null,
    [organisations, playerId],
  );

  // All organisations the player does NOT belong to (for awareness)
  const otherOrgs = useMemo(
    () => organisations.filter((org) => !org.memberEmpires.includes(playerId)),
    [organisations, playerId],
  );

  // Resolution display tab
  const [resolutionTab, setResolutionTab] = useState<'active' | 'past'>('active');

  // Split resolutions into active (voting) and past (resolved)
  const { activeResolutions, pastResolutions } = useMemo(() => {
    if (!playerOrg) return { activeResolutions: [], pastResolutions: [] };
    const active: CouncilResolution[] = [];
    const past: CouncilResolution[] = [];
    for (const r of playerOrg.resolutions) {
      if (isVotingOpen(r, playerOrg)) {
        active.push(r);
      } else {
        past.push(r);
      }
    }
    // Most recent first
    past.sort((a, b) => b.tick - a.tick);
    return { activeResolutions: active, pastResolutions: past };
  }, [playerOrg]);

  // Members sorted by voting power descending
  const sortedMembers = useMemo(() => {
    if (!playerOrg) return [];
    return [...playerOrg.memberEmpires].sort(
      (a, b) => (playerOrg.votingPower[b] ?? 0) - (playerOrg.votingPower[a] ?? 0),
    );
  }, [playerOrg]);

  const totalPower = playerOrg ? totalVotingPower(playerOrg) : 0;
  const isMature = playerOrg ? currentTick >= playerOrg.maturityTick : false;
  const ticksToMaturity = playerOrg
    ? Math.max(0, playerOrg.maturityTick - currentTick)
    : 0;

  // ---------------------------------------------------------------------------
  // Render: empty state (no organisations exist)
  // ---------------------------------------------------------------------------

  if (organisations.length === 0) {
    return (
      <div className="pm-overlay" onClick={onClose}>
        <div
          className="pm-screen"
          style={{ maxWidth: '700px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pm-header">
            <div className="pm-header__info">
              <h2 className="pm-header__name">Galactic Council</h2>
              <div className="pm-header__type">Interstellar governance</div>
            </div>
            <button
              type="button"
              className="panel-close-btn pm-header__close"
              onClick={onClose}
              aria-label="Close council screen"
            >
              &times;
            </button>
          </div>

          <div className="pm-body" style={{ padding: '32px 24px', textAlign: 'center' }}>
            <div
              style={{
                fontSize: '14px',
                color: 'var(--color-text-muted, #8899aa)',
                lineHeight: '1.7',
                maxWidth: '500px',
                margin: '0 auto',
              }}
            >
              <div
                style={{
                  fontSize: '20px',
                  color: 'var(--color-text, #c8d6e5)',
                  marginBottom: '16px',
                  fontWeight: 600,
                }}
              >
                No galactic organisation has been founded yet
              </div>
              <p>
                Organisations form when two empires with mutual diplomatic contact
                establish formal relations. Once an organisation is founded, eligible
                empires will be invited to join automatically.
              </p>
              <p style={{ marginTop: '12px' }}>
                Establish contact with neighbouring empires and build positive
                relations to trigger the formation of an interstellar governing body.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: player is not a member of any organisation
  // ---------------------------------------------------------------------------

  if (!playerOrg) {
    return (
      <div className="pm-overlay" onClick={onClose}>
        <div
          className="pm-screen"
          style={{ maxWidth: '800px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pm-header">
            <div className="pm-header__info">
              <h2 className="pm-header__name">Galactic Council</h2>
              <div className="pm-header__type">
                {organisations.length} organisation{organisations.length !== 1 ? 's' : ''} active
              </div>
            </div>
            <button
              type="button"
              className="panel-close-btn pm-header__close"
              onClick={onClose}
              aria-label="Close council screen"
            >
              &times;
            </button>
          </div>

          <div className="pm-body" style={{ padding: '24px' }}>
            <div
              style={{
                fontSize: '14px',
                color: 'var(--color-text-muted, #8899aa)',
                lineHeight: '1.7',
                marginBottom: '24px',
              }}
            >
              <div
                style={{
                  fontSize: '16px',
                  color: 'var(--color-text, #c8d6e5)',
                  marginBottom: '8px',
                  fontWeight: 600,
                }}
              >
                Not yet a member
              </div>
              <p>
                Your empire does not belong to any galactic organisation. You will be
                admitted automatically once you establish mutual diplomatic contact
                with a current member. Each empire may belong to at most one
                organisation at a time.
              </p>
            </div>

            {/* Show known organisations */}
            <div className="pm-section-label">Known Organisations</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              {organisations.map((org) => (
                <div
                  key={org.id}
                  style={{
                    padding: '12px 16px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--color-text, #c8d6e5)', fontWeight: 600, fontSize: '13px' }}>
                      {org.name}
                    </span>
                    <span style={{ color: 'var(--color-text-muted, #8899aa)', fontSize: '11px' }}>
                      {org.memberEmpires.length} member{org.memberEmpires.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #8899aa)', marginTop: '4px' }}>
                    Founded by {getEmpireName(org.founderEmpires[0], empires)} &amp;{' '}
                    {getEmpireName(org.founderEmpires[1], empires)}
                    {currentTick < org.maturityTick && (
                      <span style={{ marginLeft: '8px', color: '#f59e0b' }}>
                        Maturing ({org.maturityTick - currentTick} ticks remaining)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: player is a member -- full council view
  // ---------------------------------------------------------------------------

  const displayedResolutions =
    resolutionTab === 'active' ? activeResolutions : pastResolutions;

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div
        className="pm-screen"
        style={{ maxWidth: '1000px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* -- Header -- */}
        <div className="pm-header">
          <div className="pm-header__info">
            <h2 className="pm-header__name">{playerOrg.name}</h2>
            <div className="pm-header__type">
              {playerOrg.memberEmpires.length} member{playerOrg.memberEmpires.length !== 1 ? 's' : ''}
              {' '}&mdash;{' '}
              {isMature ? (
                <span style={{ color: '#10b981' }}>Mature (binding resolutions enabled)</span>
              ) : (
                <span style={{ color: '#f59e0b' }}>
                  Maturing ({fmt(ticksToMaturity)} ticks until binding resolutions)
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            className="panel-close-btn pm-header__close"
            onClick={onClose}
            aria-label="Close council screen"
          >
            &times;
          </button>
        </div>

        {/* -- Body: two columns -- */}
        <div
          className="pm-body"
          style={{ gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}
        >
          {/* -- Left column: Member Table -- */}
          <div
            className="pm-col"
            style={{ display: 'flex', flexDirection: 'column', gap: '0', overflow: 'hidden' }}
          >
            <div className="pm-section-label">
              Members
              <span
                className="pm-section-label__count"
                style={{ marginLeft: '6px' }}
              >
                {playerOrg.memberEmpires.length}
              </span>
            </div>

            <div style={{ flex: 1, overflow: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '12px',
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '6px 8px',
                        color: 'var(--color-text-muted, #8899aa)',
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      Empire
                    </th>
                    <th
                      style={{
                        textAlign: 'right',
                        padding: '6px 8px',
                        color: 'var(--color-text-muted, #8899aa)',
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      Voting Power
                    </th>
                    <th
                      style={{
                        textAlign: 'centre',
                        padding: '6px 8px',
                        color: 'var(--color-text-muted, #8899aa)',
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMembers.map((memberId) => {
                    const power = playerOrg.votingPower[memberId] ?? 0;
                    const pct = totalPower > 0 ? (power / totalPower) * 100 : 0;
                    const isPlayer = memberId === playerId;
                    const memberStatus = getMemberStatus(memberId, playerOrg);

                    return (
                      <tr
                        key={memberId}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          background: isPlayer ? 'rgba(99, 179, 237, 0.06)' : 'transparent',
                        }}
                      >
                        <td
                          style={{
                            padding: '8px',
                            color: isPlayer
                              ? '#63b3ed'
                              : 'var(--color-text, #c8d6e5)',
                            fontWeight: isPlayer ? 600 : 400,
                          }}
                        >
                          {getEmpireName(memberId, empires)}
                          {isPlayer && (
                            <span
                              style={{
                                marginLeft: '6px',
                                fontSize: '9px',
                                color: '#63b3ed',
                                opacity: 0.7,
                              }}
                            >
                              (you)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>
                          {/* Voting power bar + percentage */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: '8px',
                            }}
                          >
                            <div
                              style={{
                                width: '80px',
                                height: '6px',
                                background: 'rgba(255,255,255,0.06)',
                                borderRadius: '3px',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${Math.min(100, pct)}%`,
                                  height: '100%',
                                  background: isPlayer ? '#63b3ed' : '#6b7280',
                                  borderRadius: '3px',
                                  transition: 'width 0.3s ease',
                                }}
                              />
                            </div>
                            <span
                              style={{
                                minWidth: '36px',
                                textAlign: 'right',
                                color: 'var(--color-text, #c8d6e5)',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <MemberStatusBadge status={memberStatus} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Organisation info footer */}
            <div
              style={{
                marginTop: '12px',
                padding: '10px 8px',
                fontSize: '11px',
                color: 'var(--color-text-muted, #8899aa)',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                lineHeight: '1.6',
              }}
            >
              <div>
                <strong>Founded:</strong> Tick {fmt(playerOrg.formedTick)} by{' '}
                {getEmpireName(playerOrg.founderEmpires[0], empires)} &amp;{' '}
                {getEmpireName(playerOrg.founderEmpires[1], empires)}
              </div>
              {playerOrg.hasOwnMarket && (
                <div style={{ color: '#10b981' }}>Internal market active</div>
              )}
              {playerOrg.reserveCurrency && (
                <div style={{ color: '#f5c518' }}>Reserve currency established</div>
              )}
              {otherOrgs.length > 0 && (
                <div style={{ marginTop: '4px' }}>
                  {otherOrgs.length} rival organisation{otherOrgs.length !== 1 ? 's' : ''} exist
                </div>
              )}
            </div>
          </div>

          {/* -- Right column: Resolutions -- */}
          <div
            className="pm-col"
            style={{ display: 'flex', flexDirection: 'column', gap: '0', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div className="pm-section-label" style={{ marginBottom: 0 }}>Resolutions</div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['active', 'past'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className="speed-btn"
                    style={{
                      fontSize: '10px',
                      padding: '2px 10px',
                      opacity: resolutionTab === tab ? 1 : 0.5,
                      background:
                        resolutionTab === tab
                          ? 'rgba(255,255,255,0.1)'
                          : 'transparent',
                    }}
                    onClick={() => setResolutionTab(tab)}
                  >
                    {tab === 'active' ? `Active (${activeResolutions.length})` : `Past (${pastResolutions.length})`}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto' }}>
              {displayedResolutions.length === 0 ? (
                <div
                  style={{
                    color: 'var(--color-text-muted, #8899aa)',
                    fontSize: '12px',
                    padding: '24px 0',
                    textAlign: 'center',
                  }}
                >
                  {resolutionTab === 'active'
                    ? 'No resolutions currently under vote.'
                    : 'No past resolutions on record.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {displayedResolutions.map((resolution) => {
                    const status = getResolutionStatus(resolution, playerOrg);
                    const proposerName = getEmpireName(resolution.proposedBy, empires);
                    const voteCount = Object.keys(resolution.votes).length;
                    const memberCount = playerOrg.memberEmpires.length;
                    const playerVote = resolution.votes[playerId];

                    return (
                      <div
                        key={resolution.id}
                        style={{
                          padding: '10px 12px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          borderRadius: '4px',
                        }}
                      >
                        {/* Title row */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '4px',
                          }}
                        >
                          <span
                            style={{
                              color: 'var(--color-text, #c8d6e5)',
                              fontWeight: 600,
                              fontSize: '12px',
                            }}
                          >
                            {resolution.title}
                          </span>
                          <StatusBadge status={status} />
                        </div>

                        {/* Description */}
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--color-text-muted, #8899aa)',
                            marginBottom: '6px',
                            lineHeight: '1.5',
                          }}
                        >
                          {resolution.description}
                        </div>

                        {/* Meta row */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '10px',
                            color: 'var(--color-text-muted, #8899aa)',
                          }}
                        >
                          <span>
                            Proposed by {proposerName}
                            {' '}&middot;{' '}
                            <span
                              style={{
                                color: resolution.type === 'binding' ? '#a78bfa' : '#6b7280',
                              }}
                            >
                              {resolution.type === 'binding' ? 'Binding' : 'Advisory'}
                            </span>
                            {' '}&middot; Tick {fmt(resolution.tick)}
                          </span>
                          <span>
                            {voteCount}/{memberCount} voted
                            {playerVote && (
                              <span
                                style={{
                                  marginLeft: '6px',
                                  color:
                                    playerVote === 'for'
                                      ? '#10b981'
                                      : playerVote === 'against'
                                        ? '#ef4444'
                                        : '#6b7280',
                                }}
                              >
                                (You: {playerVote})
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Maturity info */}
            {!isMature && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '8px 12px',
                  fontSize: '11px',
                  color: '#f59e0b',
                  background: 'rgba(245, 158, 11, 0.06)',
                  border: '1px solid rgba(245, 158, 11, 0.15)',
                  borderRadius: '4px',
                }}
              >
                Binding resolutions will be available once the organisation matures
                in {fmt(ticksToMaturity)} ticks. Only advisory resolutions may be
                proposed until then.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
