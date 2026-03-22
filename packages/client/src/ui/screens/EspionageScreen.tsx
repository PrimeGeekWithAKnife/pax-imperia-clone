/**
 * EspionageScreen — manage spy agents, assign missions and review intel results.
 *
 * This is a self-contained UI panel. It receives all state via props so it can
 * be driven by mock data before the full engine integration is wired up.
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { Empire } from '@nova-imperia/shared';
import {
  recruitSpy,
  getSpyMissionLabel,
  getSpyStatusLabel,
  SPY_RECRUIT_COST,
  INFILTRATION_TICKS,
} from '@nova-imperia/shared';
import type {
  SpyAgent,
  SpyMission,
  EspionageState,
  EspionageEvent,
  GatherIntelResult,
  StealTechResult,
  SabotageResult,
} from '@nova-imperia/shared';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MISSION_TYPES: SpyMission[] = ['gather_intel', 'steal_tech', 'sabotage', 'counter_intel'];

const MISSION_DESCRIPTIONS: Record<SpyMission, string> = {
  gather_intel:  'Reveals the target empire\'s credits, tech count and fleet positions.',
  steal_tech:    '30% chance per turn to steal a technology the target has but you lack. Counter-intelligence reduces this.',
  sabotage:      '20% chance per turn to damage a building or delay production. Counter-intelligence reduces this.',
  counter_intel: 'Passively raises your own counter-intelligence level by 3 each turn, making your empire harder to spy on.',
};

const STATUS_COLOURS: Record<SpyAgent['status'], string> = {
  infiltrating: '#ffa726',
  active:       '#66bb6a',
  captured:     '#ef5350',
  returned:     '#78909c',
};

const EVENT_ICONS: Record<EspionageEvent['type'], string> = {
  gather_intel:  'I',
  steal_tech:    'T',
  sabotage:      'S',
  counter_intel: 'C',
  capture:       'X',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EspionageScreenProps {
  playerEmpire: Empire;
  knownEmpires: Empire[];
  espionageState: EspionageState;
  /** All espionage events logged so far (most recent first). */
  eventLog: EspionageEvent[];
  playerCredits: number;
  onClose: () => void;
  onRecruitSpy: (agent: SpyAgent) => void;
  onAssignMission: (agentId: string, targetEmpireId: string, mission: SpyMission) => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface AgentRowProps {
  agent: SpyAgent;
  knownEmpires: Empire[];
  isSelected: boolean;
  onClick: () => void;
}

function AgentRow({ agent, knownEmpires, isSelected, onClick }: AgentRowProps): React.ReactElement {
  const targetName = knownEmpires.find((e) => e.id === agent.targetEmpireId)?.name ?? '—';
  const statusColour = STATUS_COLOURS[agent.status];
  const infiltrationProgress = agent.status === 'infiltrating'
    ? Math.min(agent.turnsActive, INFILTRATION_TICKS)
    : null;

  return (
    <button
      className={`agent-row${isSelected ? ' agent-row--selected' : ''}`}
      onClick={onClick}
      title={`Spy ID: ${agent.id}`}
    >
      <span className="agent-row__skill" title="Skill level">
        {'★'.repeat(agent.skill)}{'☆'.repeat(10 - agent.skill)}
      </span>
      <span className="agent-row__status" style={{ color: statusColour }}>
        {getSpyStatusLabel(agent.status)}
        {infiltrationProgress !== null && (
          <span className="agent-row__infiltration-progress">
            {' '}({infiltrationProgress}/{INFILTRATION_TICKS})
          </span>
        )}
      </span>
      <span className="agent-row__mission">{getSpyMissionLabel(agent.mission)}</span>
      <span className="agent-row__target">{targetName}</span>
    </button>
  );
}

interface MissionPanelProps {
  agent: SpyAgent;
  knownEmpires: Empire[];
  onAssign: (targetEmpireId: string, mission: SpyMission) => void;
}

function MissionPanel({ agent, knownEmpires, onAssign }: MissionPanelProps): React.ReactElement {
  const [selectedTarget, setSelectedTarget] = useState<string>(agent.targetEmpireId);
  const [selectedMission, setSelectedMission] = useState<SpyMission>(agent.mission);

  const handleAssign = useCallback(() => {
    if (!selectedTarget) return;
    onAssign(selectedTarget, selectedMission);
  }, [selectedTarget, selectedMission, onAssign]);

  const isActive = agent.status === 'active' || agent.status === 'infiltrating';

  return (
    <div className="mission-panel">
      <h3 className="mission-panel__heading">Assign Mission</h3>

      {!isActive && (
        <p className="mission-panel__note mission-panel__note--warn">
          This agent cannot be reassigned in their current status.
        </p>
      )}

      <label className="mission-panel__label">
        Target Empire
        <select
          className="mission-panel__select"
          value={selectedTarget}
          onChange={(e) => setSelectedTarget(e.target.value)}
          disabled={!isActive}
        >
          <option value="">— Select empire —</option>
          {knownEmpires.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </label>

      <fieldset className="mission-panel__missions">
        <legend className="mission-panel__legend">Mission Type</legend>
        {MISSION_TYPES.map((m) => (
          <label key={m} className="mission-panel__radio-label">
            <input
              type="radio"
              name="mission"
              value={m}
              checked={selectedMission === m}
              onChange={() => setSelectedMission(m)}
              disabled={!isActive}
            />
            <span className="mission-panel__mission-name">{getSpyMissionLabel(m)}</span>
            <span className="mission-panel__mission-desc">{MISSION_DESCRIPTIONS[m]}</span>
          </label>
        ))}
      </fieldset>

      <button
        className="mission-panel__assign-btn"
        onClick={handleAssign}
        disabled={!isActive || !selectedTarget}
      >
        Assign Mission
      </button>

      <dl className="mission-panel__agent-info">
        <dt>Agent Skill</dt>
        <dd>{agent.skill}/10</dd>
        <dt>Turns Active</dt>
        <dd>{agent.turnsActive}</dd>
        <dt>Agent ID</dt>
        <dd style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>{agent.id}</dd>
      </dl>
    </div>
  );
}

interface EventLogEntryProps {
  event: EspionageEvent;
  knownEmpires: Empire[];
}

function EventLogEntry({ event, knownEmpires }: EventLogEntryProps): React.ReactElement {
  const empireLabel = (id: string): string =>
    knownEmpires.find((e) => e.id === id)?.name ?? id;

  function buildDescription(): string {
    switch (event.type) {
      case 'gather_intel': {
        const e = event as GatherIntelResult;
        const target = empireLabel(e.targetEmpireId);
        if (e.credits !== null) {
          return `Intel gathered on ${target}: ${e.credits.toLocaleString()} credits, ${e.techCount ?? '?'} technologies, ${e.fleetSystemIds.length} known systems.`;
        }
        return `Intel attempted on ${target} but no data retrieved.`;
      }
      case 'steal_tech': {
        const e = event as StealTechResult;
        const target = empireLabel(e.targetEmpireId);
        if (e.stolenTechId) {
          return `Technology stolen from ${target}: ${e.stolenTechId}.`;
        }
        return `Attempted to steal tech from ${target} — operation unsuccessful.`;
      }
      case 'sabotage': {
        const e = event as SabotageResult;
        const target = empireLabel(e.targetEmpireId);
        return e.targetPlanetId
          ? `Sabotage successful on ${target} (planet ${e.targetPlanetId}).`
          : `Sabotage conducted against ${target}. ${e.description}`;
      }
      case 'counter_intel':
        return `Counter-intelligence raised by ${event.levelIncrease} points.`;
      case 'capture': {
        const target = empireLabel(event.targetEmpireId);
        return `Agent captured by ${target}! Diplomatic relations will suffer.`;
      }
    }
  }

  const icon = EVENT_ICONS[event.type];
  const isNegative = event.type === 'capture';
  const isPositive = event.type === 'steal_tech' || event.type === 'sabotage';

  return (
    <li
      className={`event-log__entry${isNegative ? ' event-log__entry--negative' : ''}${isPositive ? ' event-log__entry--positive' : ''}`}
    >
      <span className="event-log__icon" aria-hidden="true">{icon}</span>
      <span className="event-log__text">{buildDescription()}</span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export function EspionageScreen({
  playerEmpire,
  knownEmpires,
  espionageState,
  eventLog,
  playerCredits,
  onClose,
  onRecruitSpy,
  onAssignMission,
}: EspionageScreenProps): React.ReactElement {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const myAgents = useMemo(
    () => espionageState.agents.filter((a) => a.empireId === playerEmpire.id),
    [espionageState.agents, playerEmpire.id],
  );

  const selectedAgent = useMemo(
    () => myAgents.find((a) => a.id === selectedAgentId) ?? null,
    [myAgents, selectedAgentId],
  );

  const counterIntelLevel = espionageState.counterIntelLevel.get(playerEmpire.id) ?? 0;

  const canAffordSpy = playerCredits >= SPY_RECRUIT_COST;

  const handleRecruit = useCallback(() => {
    if (!canAffordSpy) return;
    const agent = recruitSpy(playerEmpire.id, playerEmpire.species);
    onRecruitSpy(agent);
  }, [canAffordSpy, playerEmpire, onRecruitSpy]);

  const handleAssignMission = useCallback(
    (targetEmpireId: string, mission: SpyMission) => {
      if (!selectedAgentId) return;
      onAssignMission(selectedAgentId, targetEmpireId, mission);
    },
    [selectedAgentId, onAssignMission],
  );

  // Select the first agent if none selected and agents exist
  const effectiveSelectedAgent = selectedAgent ?? (myAgents.length > 0 && selectedAgentId === null ? null : selectedAgent);

  // Filter event log to events involving this empire's agents
  const myEvents = useMemo(
    () => eventLog.filter((e) => {
      if (e.type === 'capture') return e.empireId === playerEmpire.id;
      if (e.type === 'counter_intel') return e.empireId === playerEmpire.id;
      return (e as { agentId?: string }).agentId !== undefined &&
        myAgents.some((a) => a.id === (e as { agentId: string }).agentId);
    }),
    [eventLog, playerEmpire.id, myAgents],
  );

  return (
    <div className="espionage-screen" role="dialog" aria-label="Espionage">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="espionage-screen__header">
        <h2 className="espionage-screen__title">Espionage</h2>
        <button
          className="espionage-screen__close"
          onClick={onClose}
          aria-label="Close espionage screen"
        >
          ✕
        </button>
      </header>

      {/* ── Counter-intelligence summary ────────────────────────────── */}
      <section className="espionage-screen__ci-bar" aria-label="Counter-intelligence">
        <span className="espionage-screen__ci-label">Counter-Intelligence:</span>
        <div
          className="espionage-screen__ci-track"
          role="progressbar"
          aria-valuenow={counterIntelLevel}
          aria-valuemin={0}
          aria-valuemax={100}
          title={`Counter-intel: ${counterIntelLevel}/100`}
        >
          <div
            className="espionage-screen__ci-fill"
            style={{ width: `${counterIntelLevel}%` }}
          />
        </div>
        <span className="espionage-screen__ci-value">{counterIntelLevel}/100</span>
        <span className="espionage-screen__ci-hint">
          (Raised by Communications Hub buildings and Counter-Intelligence agents)
        </span>
      </section>

      {/* ── Main body: agent list + detail/log panes ─────────────────── */}
      <div className="espionage-screen__body">

        {/* ── Left pane: agent list ─────────────────────────────────── */}
        <section className="espionage-screen__agents" aria-label="Spy agents">
          <header className="espionage-screen__agents-header">
            <h3 className="espionage-screen__agents-title">
              Agents ({myAgents.length})
            </h3>
            <button
              className={`espionage-screen__recruit-btn${canAffordSpy ? '' : ' espionage-screen__recruit-btn--disabled'}`}
              onClick={handleRecruit}
              disabled={!canAffordSpy}
              title={canAffordSpy ? `Recruit spy (${SPY_RECRUIT_COST} credits)` : `Insufficient credits (need ${SPY_RECRUIT_COST})`}
            >
              + Recruit Spy
              <span className="espionage-screen__recruit-cost">{SPY_RECRUIT_COST.toLocaleString()} ₵</span>
            </button>
          </header>

          {myAgents.length === 0 ? (
            <p className="espionage-screen__empty">
              No agents deployed. Recruit a spy to begin espionage operations.
            </p>
          ) : (
            <ul className="espionage-screen__agent-list" role="listbox" aria-label="Agent list">
              {myAgents.map((agent) => (
                <li key={agent.id} role="option" aria-selected={agent.id === selectedAgentId}>
                  <AgentRow
                    agent={agent}
                    knownEmpires={knownEmpires}
                    isSelected={agent.id === selectedAgentId}
                    onClick={() => setSelectedAgentId(agent.id === selectedAgentId ? null : agent.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Centre pane: mission assignment ───────────────────────── */}
        <section className="espionage-screen__mission" aria-label="Mission assignment">
          {effectiveSelectedAgent ? (
            <MissionPanel
              agent={effectiveSelectedAgent}
              knownEmpires={knownEmpires}
              onAssign={handleAssignMission}
            />
          ) : (
            <div className="espionage-screen__mission-placeholder">
              <p>Select an agent to assign a mission.</p>
            </div>
          )}
        </section>

        {/* ── Right pane: event log ─────────────────────────────────── */}
        <section className="espionage-screen__log" aria-label="Intelligence log">
          <h3 className="espionage-screen__log-title">Intelligence Log</h3>
          {myEvents.length === 0 ? (
            <p className="espionage-screen__log-empty">No events recorded yet.</p>
          ) : (
            <ul className="event-log">
              {myEvents.map((event, idx) => (
                <EventLogEntry
                  key={idx}
                  event={event}
                  knownEmpires={knownEmpires}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
