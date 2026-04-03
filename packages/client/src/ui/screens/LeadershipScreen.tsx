import React, { useState, useCallback } from 'react';
import type { EmpireLeader, LeaderRole } from '@nova-imperia/shared';
import {
  LEADER_ROLE_LABELS,
  LEADER_MODIFIER_KEYS,
  LEADER_MODIFIER_LABELS,
  ALL_LEADER_ROLES,
} from '@nova-imperia/shared';
import { calculateLeaderRating, generateLeaderCandidates } from '@nova-imperia/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LeadershipScreenProps {
  leaders: EmpireLeader[];
  playerEmpireId: string;
  onReplaceLeader: (role: LeaderRole, newLeader: EmpireLeader) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROLE_ICONS: Record<LeaderRole, string> = {
  head_of_research: 'RES',
  spy_master: 'SPY',
  admiral: 'ADM',
  general: 'GEN',
};

function ratingColour(rating: number): string {
  if (rating >= 75) return '#22d46e';
  if (rating >= 50) return '#d4a022';
  if (rating >= 25) return '#d48022';
  return '#d42222';
}

function modifierColour(value: number): string {
  if (value > 0) return '#44cc88';
  if (value < 0) return '#ee4444';
  return '#889098';
}

function formatModifier(value: number): string {
  return value >= 0 ? `+${value}%` : `${value}%`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface CandidatePanelProps {
  role: LeaderRole;
  candidates: EmpireLeader[];
  onSelect: (candidate: EmpireLeader) => void;
  onCancel: () => void;
}

function CandidatePanel({ role, candidates, onSelect, onCancel }: CandidatePanelProps): React.ReactElement {
  return (
    <div className="leadership-screen__candidates-overlay" onClick={onCancel}>
      <div className="leadership-screen__candidates-panel" onClick={(e) => e.stopPropagation()}>
        <div className="leadership-screen__candidates-header">
          <h3>Replace {LEADER_ROLE_LABELS[role]}</h3>
          <button
            type="button"
            className="panel-close-btn"
            onClick={onCancel}
            aria-label="Cancel replacement"
          >
            x
          </button>
        </div>
        <p className="leadership-screen__candidates-hint">
          Select a candidate to appoint as the new {LEADER_ROLE_LABELS[role]}.
        </p>
        <div className="leadership-screen__candidates-list">
          {candidates.map((c) => {
            const rating = calculateLeaderRating(c);
            const keys = LEADER_MODIFIER_KEYS[role];
            return (
              <button
                key={c.id}
                type="button"
                className="leadership-screen__candidate-card"
                onClick={() => onSelect(c)}
              >
                <div className="leadership-screen__candidate-top">
                  <span className="leadership-screen__candidate-name">{c.name}</span>
                  <span
                    className="leadership-screen__candidate-rating"
                    style={{ color: ratingColour(rating) }}
                  >
                    {rating}
                  </span>
                </div>
                <div className="leadership-screen__candidate-trait">{c.trait}</div>
                <div className="leadership-screen__candidate-modifiers">
                  {keys.map((key) => {
                    const val = c.modifiers[key] ?? 0;
                    return (
                      <span key={key} style={{ color: modifierColour(val) }}>
                        {LEADER_MODIFIER_LABELS[key] ?? key}: {formatModifier(val)}
                      </span>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LeadershipScreen
// ---------------------------------------------------------------------------

export function LeadershipScreen({
  leaders,
  playerEmpireId,
  onReplaceLeader,
  onClose,
}: LeadershipScreenProps): React.ReactElement {
  const [replacingRole, setReplacingRole] = useState<LeaderRole | null>(null);
  const [candidates, setCandidates] = useState<EmpireLeader[]>([]);

  const handleReplace = useCallback(
    (role: LeaderRole) => {
      const pool = generateLeaderCandidates(playerEmpireId, role, 5);
      setCandidates(pool);
      setReplacingRole(role);
    },
    [playerEmpireId],
  );

  const handleSelectCandidate = useCallback(
    (candidate: EmpireLeader) => {
      if (replacingRole) {
        onReplaceLeader(replacingRole, candidate);
      }
      setReplacingRole(null);
      setCandidates([]);
    },
    [replacingRole, onReplaceLeader],
  );

  const handleCancelReplace = useCallback(() => {
    setReplacingRole(null);
    setCandidates([]);
  }, []);

  const leaderByRole = new Map<LeaderRole, EmpireLeader>();
  for (const l of leaders) {
    leaderByRole.set(l.role, l);
  }

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div
        className="pm-screen leadership-screen"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pm-header">
          <div className="pm-header__info">
            <h2 className="pm-header__name">Empire Leadership</h2>
            <div className="pm-header__type">
              {leaders.length} of {ALL_LEADER_ROLES.length} positions filled
            </div>
          </div>
          <button
            type="button"
            className="panel-close-btn pm-header__close"
            onClick={onClose}
            aria-label="Close leadership screen"
          >
            x
          </button>
        </div>

        <div className="leadership-screen__body">
          {ALL_LEADER_ROLES.map((role) => {
            const leader = leaderByRole.get(role);
            const rating = leader ? calculateLeaderRating(leader) : 0;
            const keys = LEADER_MODIFIER_KEYS[role];

            return (
              <div key={role} className="leadership-screen__card">
                <div className="leadership-screen__card-header">
                  <span className="leadership-screen__role-badge">
                    {ROLE_ICONS[role]}
                  </span>
                  <div className="leadership-screen__role-info">
                    <div className="leadership-screen__role-title">
                      {LEADER_ROLE_LABELS[role]}
                    </div>
                    {leader ? (
                      <div className="leadership-screen__leader-name">
                        {leader.name}
                      </div>
                    ) : (
                      <div className="leadership-screen__vacant">Vacant</div>
                    )}
                  </div>
                  <div
                    className="leadership-screen__rating"
                    style={{ color: leader ? ratingColour(rating) : '#555' }}
                  >
                    {leader ? rating : '--'}
                  </div>
                </div>

                {leader && (
                  <>
                    <div className="leadership-screen__trait">{leader.trait}</div>

                    <div className="leadership-screen__xp-section">
                      <div className="leadership-screen__xp-label">
                        <span>Experience</span>
                        <span>{Math.round(leader.experience)}/100</span>
                      </div>
                      <div className="leadership-screen__xp-track">
                        <div
                          className="leadership-screen__xp-fill"
                          style={{ width: `${leader.experience}%` }}
                        />
                      </div>
                    </div>

                    <div className="leadership-screen__service">
                      Turns served: {leader.turnsServed.toLocaleString()}
                    </div>

                    <table className="leadership-screen__modifier-table">
                      <thead>
                        <tr>
                          <th>Modifier</th>
                          <th>Effect</th>
                        </tr>
                      </thead>
                      <tbody>
                        {keys.map((key) => {
                          const val = leader.modifiers[key] ?? 0;
                          return (
                            <tr key={key}>
                              <td>{LEADER_MODIFIER_LABELS[key] ?? key}</td>
                              <td style={{ color: modifierColour(val), textAlign: 'right' }}>
                                {formatModifier(val)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </>
                )}

                <button
                  type="button"
                  className="leadership-screen__replace-btn"
                  onClick={() => handleReplace(role)}
                >
                  {leader ? 'Replace' : 'Appoint'}
                </button>
              </div>
            );
          })}
        </div>

        {replacingRole && candidates.length > 0 && (
          <CandidatePanel
            role={replacingRole}
            candidates={candidates}
            onSelect={handleSelectCandidate}
            onCancel={handleCancelReplace}
          />
        )}
      </div>
    </div>
  );
}
