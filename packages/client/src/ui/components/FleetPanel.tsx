import React, { useState, useCallback, useEffect } from 'react';
import type { Fleet, Ship, FleetStance, ShipDesign, Planet } from '@nova-imperia/shared';
import { findPath, determineTravelMode } from '@nova-imperia/shared';
import { renderShipThumbnail } from '../../assets/graphics';
import { getGameEngine } from '../../engine/GameEngine';
import { useGameEvent } from '../hooks/useGameEvents';

// ── Helpers ────────────────────────────────────────────────────────────────────

function emitToPhaser(eventName: string, data: unknown): void {
  const game = (window as unknown as Record<string, unknown>).__EX_NIHILO_GAME__ as
    | { events: { emit: (e: string, d: unknown) => void } }
    | undefined;
  game?.events.emit(eventName, data);
}

function hpColor(pct: number): string {
  if (pct > 0.66) return '#22d46e';
  if (pct > 0.33) return '#d4a022';
  return '#d42222';
}

function damageLabel(v: number): string {
  if (v === 0) return '';
  if (v < 0.33) return 'Light';
  if (v < 0.66) return 'Heavy';
  return 'Crit';
}

const STANCE_ICONS: Record<FleetStance, string> = {
  aggressive: 'AGR',
  defensive:  'DEF',
  evasive:    'EVA',
  patrol:     'PAT',
};

const STANCE_LABELS: Record<FleetStance, string> = {
  aggressive: 'Aggressive — attack on sight',
  defensive:  'Defensive — hold position, retaliate',
  evasive:    'Evasive — avoid combat',
  patrol:     'Patrol — orbit and intercept',
};

const STANCES: FleetStance[] = ['aggressive', 'defensive', 'evasive', 'patrol'];

// ── Helpers ─────────────────────────────────────────────────────────────────────

/**
 * Resolve the hull class for a ship by looking up its design.
 * Returns 'scout' as a safe fallback when the design cannot be found.
 */
function resolveHullClass(ship: Ship, designs: ShipDesign[]): import('@nova-imperia/shared').HullClass {
  return designs.find((d) => d.id === ship.designId)?.hull ?? 'scout';
}

// ── FleetPanel ─────────────────────────────────────────────────────────────────

export interface FleetPanelProps {
  fleet: Fleet;
  ships: Ship[];
  /** Known ship designs, used to look up hull class for thumbnail rendering. */
  designs?: ShipDesign[];
  /** When true, the fleet panel is shown inside the system view (not the galaxy map). */
  isSystemView?: boolean;
  /** Human-readable name of the system the fleet is in (avoids showing raw UUIDs). */
  systemName?: string;
  /** Planets in the fleet's current system, used for orbit-target selection. */
  planets?: Planet[];
  /** Called when the player changes the fleet's orbit target. */
  onSetOrbitTarget?: (fleetId: string, orbitTarget: string) => void;
  onClose: () => void;
}

export function FleetPanel({
  fleet,
  ships,
  designs = [],
  isSystemView = false,
  systemName,
  planets = [],
  onSetOrbitTarget,
  onClose,
}: FleetPanelProps): React.ReactElement {
  const displaySystemName = systemName ?? fleet.position.systemId;
  const [fleetName, setFleetName] = useState(fleet.name);
  const [editingName, setEditingName] = useState(false);
  const [stance, setStance] = useState<FleetStance>(fleet.stance);
  const [moveToActive, setMoveToActive] = useState(false);
  const [addWaypointMode, setAddWaypointMode] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [splitSelected, setSplitSelected] = useState<Set<string>>(new Set());
  const [showDisband, setShowDisband] = useState(false);

  // ── Relocation confirmation state ─────────────────────────────────────────
  const [relocateTarget, setRelocateTarget] = useState<{
    systemId: string;
    systemName: string;
    estimatedTurns: number;
  } | null>(null);

  // Listen for destination selection from the galaxy map while in move mode
  const handleDestinationSelected = useCallback(
    (data: { fleetId: string; systemId: string; systemName: string }) => {
      if (data.fleetId !== fleet.id) return;

      // If in add-waypoint mode, directly queue the waypoint
      if (addWaypointMode) {
        const engine = getGameEngine();
        if (engine) {
          engine.addWaypoint(fleet.id, data.systemId);
        }
        setAddWaypointMode(false);
        emitToPhaser('fleet:move_mode_clear', {});
        return;
      }

      // Calculate estimated travel time
      const engine = getGameEngine();
      let estimatedTurns = 1;
      if (engine) {
        const tickState = engine.getState();
        const galaxy = tickState.gameState.galaxy;
        const playerEmpire = tickState.gameState.empires.find(e => !e.isAI);
        const empireTechs = playerEmpire?.technologies ?? [];
        const travelMode = determineTravelMode(empireTechs);

        // Ticks per hop by travel mode
        const ticksPerHopMap: Record<string, number> = {
          slow_ftl: 20,
          wormhole: 10,
          advanced_wormhole: 5,
        };
        const ticksPerHop = ticksPerHopMap[travelMode] ?? 10;

        const pathResult = findPath(galaxy, fleet.position.systemId, data.systemId);
        if (pathResult.found) {
          const hops = pathResult.path.length - 1;
          estimatedTurns = Math.max(1, hops * ticksPerHop);
        }
      }

      setRelocateTarget({
        systemId: data.systemId,
        systemName: data.systemName,
        estimatedTurns,
      });
    },
    [fleet.id, fleet.position.systemId, addWaypointMode],
  );

  useGameEvent<{ fleetId: string; systemId: string; systemName: string }>(
    'fleet:destination_selected',
    handleDestinationSelected,
  );

  const handleRelocateConfirm = useCallback(() => {
    if (!relocateTarget) return;
    const engine = getGameEngine();
    if (engine) {
      engine.moveFleet(fleet.id, relocateTarget.systemId);
    }
    setRelocateTarget(null);
    setMoveToActive(false);
    emitToPhaser('fleet:move_mode_clear', {});
  }, [fleet.id, relocateTarget]);

  const handleRelocateCancel = useCallback(() => {
    setRelocateTarget(null);
    // Keep move mode active so the player can pick a different target
  }, []);

  // Clear relocation state if the fleet changes
  useEffect(() => {
    setRelocateTarget(null);
  }, [fleet.id]);

  // ── Waypoint helpers ──────────────────────────────────────────────────────

  /** Resolve system names for display in the waypoint list. */
  const resolveSystemName = useCallback((systemId: string): string => {
    const engine = getGameEngine();
    if (!engine) return systemId;
    const sys = engine.getState().gameState.galaxy.systems.find(
      (s: { id: string; name: string }) => s.id === systemId,
    );
    return sys?.name ?? systemId;
  }, []);

  const handleAddWaypointToggle = useCallback(() => {
    const next = !addWaypointMode;
    setAddWaypointMode(next);
    setMoveToActive(false);
    emitToPhaser('fleet:move_mode', { fleetId: fleet.id, active: next });
  }, [fleet.id, addWaypointMode]);

  const handleClearWaypoints = useCallback(() => {
    const engine = getGameEngine();
    if (engine) {
      engine.clearWaypoints(fleet.id);
    }
  }, [fleet.id]);

  const handlePatrolToggle = useCallback(() => {
    const engine = getGameEngine();
    if (engine) {
      engine.setPatrolling(fleet.id, !fleet.patrolling);
    }
  }, [fleet.id, fleet.patrolling]);

  // ── Name editing ────────────────────────────────────────────────────────────

  const handleNameCommit = useCallback(() => {
    setEditingName(false);
    const trimmed = fleetName.trim();
    if (trimmed && trimmed !== fleet.name) {
      emitToPhaser('fleet:rename', { fleetId: fleet.id, name: trimmed });
    } else {
      setFleetName(fleet.name);
    }
  }, [fleet.id, fleet.name, fleetName]);

  const handleNameKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleNameCommit();
      if (e.key === 'Escape') {
        setFleetName(fleet.name);
        setEditingName(false);
      }
    },
    [fleet.name, handleNameCommit],
  );

  // ── Stance ──────────────────────────────────────────────────────────────────

  const handleStanceChange = useCallback(
    (s: FleetStance) => {
      setStance(s);
      emitToPhaser('fleet:stance', { fleetId: fleet.id, stance: s });
    },
    [fleet.id],
  );

  // ── Move To ─────────────────────────────────────────────────────────────────

  const handleMoveToToggle = useCallback(() => {
    const next = !moveToActive;
    setMoveToActive(next);
    emitToPhaser('fleet:move_mode', { fleetId: fleet.id, active: next });
  }, [fleet.id, moveToActive]);

  /** In system view, navigate to the galaxy map so the player can pick a relocation target. */
  const handleRelocateFleet = useCallback(() => {
    emitToPhaser('scene:request_galaxy_view', { fleetId: fleet.id });
  }, [fleet.id]);

  // ── Split Fleet ─────────────────────────────────────────────────────────────

  const handleToggleSplitShip = useCallback((shipId: string) => {
    setSplitSelected((prev) => {
      const next = new Set(prev);
      if (next.has(shipId)) next.delete(shipId);
      else next.add(shipId);
      return next;
    });
  }, []);

  const handleSplitConfirm = useCallback(() => {
    if (splitSelected.size === 0 || splitSelected.size === ships.length) return;
    emitToPhaser('fleet:split', {
      fleetId: fleet.id,
      shipIds: Array.from(splitSelected),
    });
    setSplitMode(false);
    setSplitSelected(new Set());
  }, [fleet.id, ships.length, splitSelected]);

  // ── Disband ─────────────────────────────────────────────────────────────────

  const handleDisband = useCallback(() => {
    emitToPhaser('fleet:disband', { fleetId: fleet.id });
    onClose();
  }, [fleet.id, onClose]);

  // ── Fleet stats summary ─────────────────────────────────────────────────────

  const totalMaxHP = ships.reduce((s, ship) => s + ship.maxHullPoints, 0);
  const totalCurrentHP = ships.reduce((s, ship) => s + ship.hullPoints, 0);
  const hpPct = totalMaxHP > 0 ? totalCurrentHP / totalMaxHP : 1;

  return (
    <div className={`fleet-panel fleet-panel--visible`}>
      {/* Header */}
      <div className="fleet-panel__header">
        <div className="fleet-panel__title-row">
          {editingName ? (
            <input
              className="fleet-panel__name-input"
              value={fleetName}
              autoFocus
              onChange={(e) => setFleetName(e.target.value)}
              onBlur={handleNameCommit}
              onKeyDown={handleNameKey}
              maxLength={40}
            />
          ) : (
            <button
              type="button"
              className="fleet-panel__name"
              onClick={() => setEditingName(true)}
              title="Click to rename"
            >
              {fleetName}
            </button>
          )}
          <button
            type="button"
            className="panel-close-btn"
            onClick={onClose}
            aria-label="Close fleet panel"
          >
            ×
          </button>
        </div>
        <div className="fleet-panel__subtitle">
          {ships.length} {ships.length === 1 ? 'ship' : 'ships'} &mdash; {displaySystemName}
        </div>
      </div>

      {/* Stance selector */}
      <section className="fleet-panel__section">
        <div className="fleet-panel__section-label">COMBAT STANCE</div>
        <div className="fleet-panel__stance-row">
          {STANCES.map((s) => (
            <button
              key={s}
              type="button"
              className={`fleet-panel__stance-btn ${stance === s ? 'fleet-panel__stance-btn--active' : ''}`}
              onClick={() => handleStanceChange(s)}
              title={STANCE_LABELS[s]}
            >
              {STANCE_ICONS[s]}
            </button>
          ))}
        </div>
        <div className="fleet-panel__stance-desc">{STANCE_LABELS[stance]}</div>
      </section>

      {/* Orbit target */}
      <section className="fleet-panel__section">
        <div className="fleet-panel__section-label">ORBIT</div>
        <select
          className="sc-input sc-input--select"
          value={fleet.orbitTarget ?? 'star'}
          onChange={(e) => onSetOrbitTarget?.(fleet.id, e.target.value)}
          style={{ fontSize: '10px', width: '100%' }}
        >
          <option value="star">Star (System Patrol)</option>
          {planets.map(p => (
            <option key={p.id} value={p.id}>{p.name} (Defend)</option>
          ))}
        </select>
      </section>

      {/* Waypoints */}
      {(fleet.waypoints.length > 0 || fleet.destination) && (
        <section className="fleet-panel__section">
          <div className="fleet-panel__section-label">
            WAYPOINTS {fleet.patrolling ? '(PATROL)' : ''}
          </div>
          <div className="fleet-panel__waypoint-list">
            {fleet.destination && !fleet.waypoints.includes(fleet.destination) && (
              <div className="fleet-panel__waypoint-item fleet-panel__waypoint-item--current">
                &rarr; {resolveSystemName(fleet.destination)}
              </div>
            )}
            {fleet.waypoints.map((wp, i) => (
              <div key={`${wp}-${i}`} className="fleet-panel__waypoint-item">
                {i + 1}. {resolveSystemName(wp)}
              </div>
            ))}
            {fleet.patrolling && fleet.waypoints.length > 0 && (
              <div className="fleet-panel__waypoint-item fleet-panel__waypoint-item--cycle">
                &#x21bb; cycle to {resolveSystemName(fleet.waypoints[0]!)}
              </div>
            )}
          </div>
          <div className="fleet-panel__waypoint-actions">
            <button
              type="button"
              className={`fleet-panel__action-btn fleet-panel__action-btn--small ${fleet.patrolling ? 'fleet-panel__action-btn--active' : ''}`}
              onClick={handlePatrolToggle}
              title={fleet.patrolling ? 'Disable patrol mode' : 'Enable patrol mode — fleet cycles through waypoints'}
            >
              {fleet.patrolling ? 'Patrolling' : 'Patrol'}
            </button>
            <button
              type="button"
              className="fleet-panel__action-btn fleet-panel__action-btn--small fleet-panel__action-btn--cancel"
              onClick={handleClearWaypoints}
              title="Clear all waypoints"
            >
              Clear
            </button>
          </div>
        </section>
      )}

      {/* Fleet strength summary */}
      <section className="fleet-panel__section">
        <div className="fleet-panel__section-label">FLEET STRENGTH</div>
        <div className="fleet-panel__hp-bar-track">
          <div
            className="fleet-panel__hp-bar-fill"
            style={{
              width: `${hpPct * 100}%`,
              background: hpColor(hpPct),
            }}
          />
        </div>
        <div className="fleet-panel__hp-label">
          {totalCurrentHP} / {totalMaxHP} HP ({Math.round(hpPct * 100)}%)
        </div>
      </section>

      {/* Ship list */}
      <section className="fleet-panel__section fleet-panel__section--ships">
        <div className="fleet-panel__section-label">SHIPS</div>
        <div className="fleet-panel__ship-list">
          {ships.map((ship) => {
            const shipHpPct = ship.maxHullPoints > 0 ? ship.hullPoints / ship.maxHullPoints : 1;
            const dmg = ship.systemDamage;
            const hasDamage = Object.values(dmg).some((v) => v > 0);
            const isInSplit = splitSelected.has(ship.id);

            return (
              <div
                key={ship.id}
                className={`fleet-panel__ship-item ${splitMode && isInSplit ? 'fleet-panel__ship-item--selected' : ''}`}
                onClick={splitMode ? () => handleToggleSplitShip(ship.id) : undefined}
                style={{ cursor: splitMode ? 'pointer' : 'default' }}
              >
                <div className="fleet-panel__ship-row">
                  {splitMode && (
                    <span className={`fleet-panel__split-check ${isInSplit ? 'fleet-panel__split-check--on' : ''}`}>
                      {isInSplit ? '[x]' : '[ ]'}
                    </span>
                  )}
                  {(() => {
                    const hullClass = resolveHullClass(ship, designs);
                    const thumbSrc = renderShipThumbnail(hullClass, 24);
                    return thumbSrc ? (
                      <img
                        src={thumbSrc}
                        alt={hullClass}
                        className="fleet-panel__ship-thumb"
                        width={24}
                        height={24}
                        aria-hidden="true"
                      />
                    ) : null;
                  })()}
                  <span className="fleet-panel__ship-name">{ship.name}</span>
                  <span className="fleet-panel__ship-hp" style={{ color: hpColor(shipHpPct) }}>
                    {ship.hullPoints}/{ship.maxHullPoints}
                  </span>
                </div>
                {/* HP bar */}
                <div className="fleet-panel__ship-hp-track">
                  <div
                    className="fleet-panel__ship-hp-fill"
                    style={{
                      width: `${shipHpPct * 100}%`,
                      background: hpColor(shipHpPct),
                    }}
                  />
                </div>
                {/* System damage indicators */}
                {hasDamage && (
                  <div className="fleet-panel__sys-damage">
                    {dmg.engines > 0 && (
                      <span className="fleet-panel__sys-chip fleet-panel__sys-chip--dmg">
                        ENG {damageLabel(dmg.engines)}
                      </span>
                    )}
                    {dmg.weapons > 0 && (
                      <span className="fleet-panel__sys-chip fleet-panel__sys-chip--dmg">
                        WPN {damageLabel(dmg.weapons)}
                      </span>
                    )}
                    {dmg.shields > 0 && (
                      <span className="fleet-panel__sys-chip fleet-panel__sys-chip--dmg">
                        SHD {damageLabel(dmg.shields)}
                      </span>
                    )}
                    {dmg.sensors > 0 && (
                      <span className="fleet-panel__sys-chip fleet-panel__sys-chip--dmg">
                        SNS {damageLabel(dmg.sensors)}
                      </span>
                    )}
                    {dmg.warpDrive > 0 && (
                      <span className="fleet-panel__sys-chip fleet-panel__sys-chip--dmg">
                        WRP {damageLabel(dmg.warpDrive)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Actions */}
      <section className="fleet-panel__section">
        <div className="fleet-panel__section-label">ACTIONS</div>
        <div className="fleet-panel__actions">
          {isSystemView ? (
            <button
              type="button"
              className="fleet-panel__action-btn"
              onClick={handleRelocateFleet}
              title="Switch to galaxy view to select a relocation target"
            >
              Relocate Fleet
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`fleet-panel__action-btn ${moveToActive ? 'fleet-panel__action-btn--active' : ''}`}
                onClick={handleMoveToToggle}
                title="Activate move mode then click a star system on the galaxy map"
              >
                {moveToActive ? 'Select Target...' : 'Move To'}
              </button>
              <button
                type="button"
                className={`fleet-panel__action-btn ${addWaypointMode ? 'fleet-panel__action-btn--active' : ''}`}
                onClick={handleAddWaypointToggle}
                title="Click a system on the galaxy map to add a waypoint"
              >
                {addWaypointMode ? 'Select Waypoint...' : 'Add Waypoint'}
              </button>
            </>
          )}

          {!splitMode ? (
            <button
              type="button"
              className="fleet-panel__action-btn"
              onClick={() => setSplitMode(true)}
              disabled={ships.length < 2}
              title="Select ships to split into a new fleet"
            >
              Split Fleet
            </button>
          ) : (
            <div className="fleet-panel__split-controls">
              <button
                type="button"
                className="fleet-panel__action-btn fleet-panel__action-btn--confirm"
                onClick={handleSplitConfirm}
                disabled={splitSelected.size === 0 || splitSelected.size === ships.length}
              >
                Confirm Split ({splitSelected.size})
              </button>
              <button
                type="button"
                className="fleet-panel__action-btn fleet-panel__action-btn--cancel"
                onClick={() => {
                  setSplitMode(false);
                  setSplitSelected(new Set());
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Relocation confirmation dialog */}
      {relocateTarget && (
        <section className="fleet-panel__section fleet-panel__section--relocate">
          <div className="fleet-panel__relocate-confirm">
            <div className="fleet-panel__relocate-message">
              Relocate <strong>{fleetName}</strong> to <strong>{relocateTarget.systemName}</strong>?
              <br />
              Estimated travel: {relocateTarget.estimatedTurns} {relocateTarget.estimatedTurns === 1 ? 'turn' : 'turns'}
            </div>
            <div className="fleet-panel__relocate-btns">
              <button
                type="button"
                className="fleet-panel__action-btn fleet-panel__action-btn--confirm"
                onClick={handleRelocateConfirm}
              >
                Confirm
              </button>
              <button
                type="button"
                className="fleet-panel__action-btn fleet-panel__action-btn--cancel"
                onClick={handleRelocateCancel}
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Disband */}
      <section className="fleet-panel__section fleet-panel__section--danger">
        {!showDisband ? (
          <button
            type="button"
            className="fleet-panel__disband-btn"
            onClick={() => setShowDisband(true)}
          >
            Disband Fleet
          </button>
        ) : (
          <div className="fleet-panel__disband-confirm">
            <div className="fleet-panel__disband-warning">
              Disband this fleet? All ships will be left at {displaySystemName}.
            </div>
            <div className="fleet-panel__disband-btns">
              <button
                type="button"
                className="fleet-panel__action-btn fleet-panel__action-btn--danger"
                onClick={handleDisband}
              >
                Confirm
              </button>
              <button
                type="button"
                className="fleet-panel__action-btn fleet-panel__action-btn--cancel"
                onClick={() => setShowDisband(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
