import React, { useState, useCallback } from 'react';
import type { Fleet, Ship, FleetStance, ShipDesign } from '@nova-imperia/shared';
import { renderShipThumbnail } from '../../assets/graphics';

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
  onClose: () => void;
}

export function FleetPanel({
  fleet,
  ships,
  designs = [],
  isSystemView = false,
  systemName,
  onClose,
}: FleetPanelProps): React.ReactElement {
  const displaySystemName = systemName ?? fleet.position.systemId;
  const [fleetName, setFleetName] = useState(fleet.name);
  const [editingName, setEditingName] = useState(false);
  const [stance, setStance] = useState<FleetStance>(fleet.stance);
  const [moveToActive, setMoveToActive] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [splitSelected, setSplitSelected] = useState<Set<string>>(new Set());
  const [showDisband, setShowDisband] = useState(false);

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

  /** In system view, navigate back to galaxy map so the player can pick a target. */
  const handleGoToGalaxyView = useCallback(() => {
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
              onClick={handleGoToGalaxyView}
              title="Return to the galaxy map to select a movement target"
            >
              Move To Galaxy View
            </button>
          ) : (
            <button
              type="button"
              className={`fleet-panel__action-btn ${moveToActive ? 'fleet-panel__action-btn--active' : ''}`}
              onClick={handleMoveToToggle}
              title="Activate move mode then click a star system on the galaxy map"
            >
              {moveToActive ? 'Select Target...' : 'Move To'}
            </button>
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
