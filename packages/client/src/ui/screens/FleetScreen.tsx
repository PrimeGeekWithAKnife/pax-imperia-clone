import React, { useState, useCallback, useMemo } from 'react';
import type { Fleet, Ship, FleetStance, ShipDesign, FleetMovementOrder, HullClass } from '@nova-imperia/shared';
import { findPath } from '@nova-imperia/shared';
import { getGameEngine } from '../../engine/GameEngine';
import { renderShipThumbnail } from '../../assets/graphics';
import { useGameEvent } from '../hooks/useGameEvents';

// ── Helpers ────────────────────────────────────────────────────────────────────

function hpColor(pct: number): string {
  if (pct > 0.66) return '#22d46e';
  if (pct > 0.33) return '#d4a022';
  return '#d42222';
}

const STANCE_ICONS: Record<FleetStance, string> = {
  aggressive: 'AGR',
  defensive:  'DEF',
  evasive:    'EVA',
  patrol:     'PAT',
};

const STANCE_LABELS: Record<FleetStance, string> = {
  aggressive: 'Aggressive',
  defensive:  'Defensive',
  evasive:    'Evasive',
  patrol:     'Patrol',
};

const STANCES: FleetStance[] = ['aggressive', 'defensive', 'evasive', 'patrol'];

function resolveHullClass(ship: Ship, designs: ShipDesign[]): HullClass {
  return designs.find((d) => d.id === ship.designId)?.hull ?? 'scout';
}

function emitToPhaser(eventName: string, data: unknown): void {
  const game = (window as unknown as Record<string, unknown>).__EX_NIHILO_GAME__ as
    | { events: { emit: (e: string, d: unknown) => void } }
    | undefined;
  game?.events.emit(eventName, data);
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface ReachableSystem {
  id: string;
  name: string;
  hops: number;
  etaTurns: number;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface FleetListItemProps {
  fleet: Fleet;
  ships: Ship[];
  movementOrders: FleetMovementOrder[];
  allSystems: Array<{ id: string; name: string }>;
  isSelected: boolean;
  onClick: () => void;
}

function FleetListItem({ fleet, ships, movementOrders, allSystems, isSelected, onClick }: FleetListItemProps): React.ReactElement {
  const fleetShips = useMemo(() => ships.filter(s => fleet.ships.includes(s.id)), [ships, fleet.ships]);
  const totalMaxHP = fleetShips.reduce((s, ship) => s + ship.maxHullPoints, 0);
  const totalCurrentHP = fleetShips.reduce((s, ship) => s + ship.hullPoints, 0);
  const hpPct = totalMaxHP > 0 ? totalCurrentHP / totalMaxHP : 1;

  const order = movementOrders.find(o => o.fleetId === fleet.id);
  const systemName = allSystems.find(s => s.id === fleet.position.systemId)?.name ?? fleet.position.systemId;
  const destName = fleet.destination ? (allSystems.find(s => s.id === fleet.destination)?.name ?? fleet.destination) : null;

  // ETA: hops remaining * ticksPerHop
  let etaLabel = '';
  if (order && destName) {
    const hopsLeft = order.path.length - 1 - order.currentSegment + 1;
    const ticksLeft = hopsLeft * order.ticksPerHop - order.ticksInTransit + order.ticksPerHop - 1;
    etaLabel = `→ ${destName} (${Math.max(1, ticksLeft)} turns)`;
  }

  return (
    <button
      type="button"
      className={`fleet-screen__fleet-item${isSelected ? ' fleet-screen__fleet-item--selected' : ''}`}
      onClick={onClick}
    >
      <div className="fleet-screen__fleet-item-header">
        <span className="fleet-screen__fleet-item-name">{fleet.name}</span>
        <span className={`fleet-screen__stance-badge fleet-screen__stance-badge--${fleet.stance}`}>
          {STANCE_ICONS[fleet.stance]}
        </span>
      </div>
      <div className="fleet-screen__fleet-item-meta">
        <span className="fleet-screen__fleet-item-loc">
          {destName ? `In transit: ${etaLabel}` : systemName}
        </span>
        <span className="fleet-screen__fleet-item-ships">{fleetShips.length} ship{fleetShips.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="fleet-screen__fleet-hp-track">
        <div
          className="fleet-screen__fleet-hp-fill"
          style={{ width: `${hpPct * 100}%`, background: hpColor(hpPct) }}
        />
      </div>
    </button>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

export interface FleetScreenProps {
  onClose: () => void;
}

// ── FleetScreen ────────────────────────────────────────────────────────────────

export function FleetScreen({ onClose }: FleetScreenProps): React.ReactElement {
  // Force re-render on each engine tick so fleet positions, movement orders,
  // and transit progress stay in sync with the authoritative engine state.
  const [, setTickCounter] = useState(0);
  useGameEvent('engine:tick', useCallback(() => {
    setTickCounter(prev => prev + 1);
  }, []));

  const engine = getGameEngine();
  const state = engine?.getState();
  const galaxy = state?.gameState.galaxy ?? null;
  const allFleets: Fleet[] = state?.gameState.fleets ?? [];
  const allShips: Ship[] = state?.gameState.ships ?? [];
  const movementOrders = state?.movementOrders ?? [];

  // Derive available designs from ship designs map
  const designs: ShipDesign[] = useMemo(() => {
    const map = state?.shipDesigns;
    if (!map) return [];
    return Array.from(map.values());
  }, [state]);

  const allSystems = useMemo(() => galaxy?.systems.map(s => ({ id: s.id, name: s.name })) ?? [], [galaxy]);

  // ── Local state ───────────────────────────────────────────────────────────

  const [selectedFleetId, setSelectedFleetId] = useState<string | null>(
    allFleets.length > 0 ? (allFleets[0]?.id ?? null) : null,
  );
  const [editingName, setEditingName] = useState(false);
  const [fleetName, setFleetName] = useState('');
  const [moveModeActive, setMoveModeActive] = useState(false);

  // ── Derived: selected fleet + its ships ───────────────────────────────────

  const selectedFleet = useMemo(
    () => allFleets.find(f => f.id === selectedFleetId) ?? null,
    [allFleets, selectedFleetId],
  );

  const selectedFleetShips = useMemo(
    () => (selectedFleet ? allShips.filter(s => selectedFleet.ships.includes(s.id)) : []),
    [selectedFleet, allShips],
  );

  // Active movement order for the selected fleet
  const activeOrder = useMemo(
    () => (selectedFleet ? movementOrders.find(o => o.fleetId === selectedFleet.id) ?? null : null),
    [selectedFleet, movementOrders],
  );

  // ── Derived: fleets grouped by system ─────────────────────────────────────

  const fleetsBySystem = useMemo(() => {
    const groups = new Map<string, Fleet[]>();
    for (const fleet of allFleets) {
      const sysId = fleet.position.systemId;
      const existing = groups.get(sysId) ?? [];
      existing.push(fleet);
      groups.set(sysId, existing);
    }
    return groups;
  }, [allFleets]);

  // ── Derived: reachable systems from selected fleet ────────────────────────

  const reachableSystems = useMemo((): ReachableSystem[] => {
    if (!selectedFleet || !galaxy || !moveModeActive) return [];
    const originId = selectedFleet.position.systemId;

    // BFS to find all reachable systems and hop counts
    const visited = new Map<string, number>(); // id → hops
    const queue: Array<{ id: string; hops: number }> = [{ id: originId, hops: 0 }];
    visited.set(originId, 0);

    const sysMap = new Map(galaxy.systems.map(s => [s.id, s]));

    while (queue.length > 0) {
      const current = queue.shift()!;
      const sys = sysMap.get(current.id);
      if (!sys) continue;
      for (const neighborId of sys.wormholes) {
        if (!visited.has(neighborId)) {
          visited.set(neighborId, current.hops + 1);
          queue.push({ id: neighborId, hops: current.hops + 1 });
        }
      }
    }

    // Build list, excluding origin
    const results: ReachableSystem[] = [];
    for (const [id, hops] of visited) {
      if (id === originId) continue;
      const sys = sysMap.get(id);
      if (!sys) continue;
      results.push({ id, name: sys.name, hops, etaTurns: hops });
    }
    results.sort((a, b) => a.hops - b.hops || a.name.localeCompare(b.name));
    return results;
  }, [selectedFleet, galaxy, moveModeActive]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSelectFleet = useCallback((id: string) => {
    setSelectedFleetId(id);
    setMoveModeActive(false);
    setEditingName(false);
  }, []);

  const handleNameClick = useCallback(() => {
    if (!selectedFleet) return;
    setFleetName(selectedFleet.name);
    setEditingName(true);
  }, [selectedFleet]);

  const handleNameCommit = useCallback(() => {
    setEditingName(false);
    if (!selectedFleet) return;
    const trimmed = fleetName.trim();
    if (trimmed && trimmed !== selectedFleet.name) {
      emitToPhaser('fleet:rename', { fleetId: selectedFleet.id, name: trimmed });
    }
  }, [selectedFleet, fleetName]);

  const handleNameKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleNameCommit();
    if (e.key === 'Escape') setEditingName(false);
  }, [handleNameCommit]);

  const handleStanceChange = useCallback((s: FleetStance) => {
    if (!selectedFleet) return;
    emitToPhaser('fleet:stance', { fleetId: selectedFleet.id, stance: s });
  }, [selectedFleet]);

  const handleMoveToggle = useCallback(() => {
    setMoveModeActive(prev => !prev);
  }, []);

  const handleMoveTo = useCallback((destinationSystemId: string) => {
    if (!selectedFleet || !engine) return;
    const success = engine.moveFleet(selectedFleet.id, destinationSystemId);
    if (success) {
      setMoveModeActive(false);
    }
  }, [selectedFleet, engine]);

  const handleCancelMovement = useCallback(() => {
    if (!selectedFleet) return;
    emitToPhaser('fleet:cancel_movement', { fleetId: selectedFleet.id });
  }, [selectedFleet]);

  // ── Fleet strength ─────────────────────────────────────────────────────────

  const totalMaxHP = selectedFleetShips.reduce((s, ship) => s + ship.maxHullPoints, 0);
  const totalCurrentHP = selectedFleetShips.reduce((s, ship) => s + ship.hullPoints, 0);
  const hpPct = totalMaxHP > 0 ? totalCurrentHP / totalMaxHP : 1;

  // ── Destination info for in-transit fleets ────────────────────────────────

  const inTransitInfo = useMemo(() => {
    if (!activeOrder || !selectedFleet || !galaxy) return null;
    const destId = activeOrder.path[activeOrder.path.length - 1];
    const destSys = galaxy.systems.find(s => s.id === destId);
    const hopsLeft = activeOrder.path.length - activeOrder.currentSegment;
    const ticksLeft = hopsLeft * activeOrder.ticksPerHop - activeOrder.ticksInTransit;
    return { destName: destSys?.name ?? destId, etaTurns: Math.max(1, ticksLeft) };
  }, [activeOrder, selectedFleet, galaxy]);

  // ── Path preview for a hovered/focused destination ────────────────────────

  const [hoveredDestId, setHoveredDestId] = useState<string | null>(null);

  const pathPreview = useMemo((): string[] => {
    if (!hoveredDestId || !selectedFleet || !galaxy) return [];
    const result = findPath(galaxy, selectedFleet.position.systemId, hoveredDestId);
    return result.found ? result.path : [];
  }, [hoveredDestId, selectedFleet, galaxy]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (allFleets.length === 0 && allShips.length === 0) {
    return (
      <div className="pm-overlay" onClick={onClose}>
        <div
          className="pm-screen fleet-screen"
          style={{ maxWidth: '640px', maxHeight: '300px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pm-header">
            <div className="pm-header__info">
              <h2 className="pm-header__name">Fleet Management</h2>
            </div>
            <button type="button" className="panel-close-btn pm-header__close" onClick={onClose} aria-label="Close fleet management">
              ×
            </button>
          </div>
          <div className="fleet-screen__empty">
            <p>No ships or fleets. Build a shipyard and produce ships to get started.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div
        className="pm-screen fleet-screen"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="pm-header">
          <div className="pm-header__info">
            <h2 className="pm-header__name">Fleet Management</h2>
            <div className="pm-header__type">
              {allFleets.length} fleet{allFleets.length !== 1 ? 's' : ''} &mdash; {allShips.length} ship{allShips.length !== 1 ? 's' : ''}
            </div>
          </div>
          <button
            type="button"
            className="panel-close-btn pm-header__close"
            onClick={onClose}
            aria-label="Close fleet management"
          >
            ×
          </button>
        </div>

        {/* Three-column body */}
        <div className="pm-body fleet-screen__body">

          {/* Left: Fleet list */}
          <div className="pm-col pm-col--info fleet-screen__left-col">
            <div className="pm-section-label">Your Fleets</div>

            {Array.from(fleetsBySystem.entries()).map(([sysId, fleets]) => {
              const sysName = allSystems.find(s => s.id === sysId)?.name ?? sysId;
              return (
                <div key={sysId} className="fleet-screen__system-group">
                  <div className="fleet-screen__system-group-label">{sysName}</div>
                  {fleets.map(fleet => (
                    <FleetListItem
                      key={fleet.id}
                      fleet={fleet}
                      ships={allShips}
                      movementOrders={movementOrders}
                      allSystems={allSystems}
                      isSelected={fleet.id === selectedFleetId}
                      onClick={() => handleSelectFleet(fleet.id)}
                    />
                  ))}
                </div>
              );
            })}
          </div>

          {/* Centre: Selected fleet detail */}
          <div className="pm-col fleet-screen__centre-col">
            {selectedFleet ? (
              <>
                {/* Name */}
                <div className="fleet-screen__detail-section">
                  {editingName ? (
                    <input
                      className="fleet-screen__name-input"
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
                      className="fleet-screen__name-btn"
                      onClick={handleNameClick}
                      title="Click to rename"
                    >
                      {selectedFleet.name}
                    </button>
                  )}
                  <div className="fleet-screen__location-line">
                    {inTransitInfo
                      ? `In transit → ${inTransitInfo.destName} (${inTransitInfo.etaTurns} turn${inTransitInfo.etaTurns !== 1 ? 's' : ''})`
                      : (allSystems.find(s => s.id === selectedFleet.position.systemId)?.name ?? selectedFleet.position.systemId)
                    }
                  </div>
                </div>

                {/* Combat stance */}
                <div className="fleet-screen__detail-section">
                  <div className="pm-section-label">Combat Stance</div>
                  <div className="fleet-screen__stance-row">
                    {STANCES.map(s => (
                      <button
                        key={s}
                        type="button"
                        className={`fleet-screen__stance-btn${selectedFleet.stance === s ? ' fleet-screen__stance-btn--active' : ''}`}
                        onClick={() => handleStanceChange(s)}
                        title={STANCE_LABELS[s]}
                      >
                        {STANCE_ICONS[s]}
                        <span className="fleet-screen__stance-label">{STANCE_LABELS[s]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fleet strength */}
                <div className="fleet-screen__detail-section">
                  <div className="pm-section-label">Fleet Strength</div>
                  <div className="fleet-screen__hp-track">
                    <div
                      className="fleet-screen__hp-fill"
                      style={{ width: `${hpPct * 100}%`, background: hpColor(hpPct) }}
                    />
                  </div>
                  <div className="fleet-screen__hp-label">
                    {totalCurrentHP} / {totalMaxHP} HP ({Math.round(hpPct * 100)}%)
                  </div>
                </div>

                {/* Ship list */}
                <div className="fleet-screen__detail-section fleet-screen__detail-section--ships">
                  <div className="pm-section-label">
                    Ships
                    <span className="pm-section-label__count">{selectedFleetShips.length}</span>
                  </div>
                  <div className="fleet-screen__ship-list">
                    {selectedFleetShips.map(ship => {
                      const shipHpPct = ship.maxHullPoints > 0 ? ship.hullPoints / ship.maxHullPoints : 1;
                      const hullClass = resolveHullClass(ship, designs);
                      const thumbSrc = renderShipThumbnail(hullClass, 22);
                      return (
                        <div key={ship.id} className="fleet-screen__ship-row">
                          {thumbSrc && (
                            <img
                              src={thumbSrc}
                              alt={hullClass}
                              className="fleet-screen__ship-thumb"
                              width={22}
                              height={22}
                              aria-hidden="true"
                            />
                          )}
                          <span className="fleet-screen__ship-name">{ship.name}</span>
                          <span className="fleet-screen__ship-hp" style={{ color: hpColor(shipHpPct) }}>
                            {ship.hullPoints}/{ship.maxHullPoints}
                          </span>
                          <div className="fleet-screen__ship-hp-track">
                            <div
                              className="fleet-screen__ship-hp-fill"
                              style={{ width: `${shipHpPct * 100}%`, background: hpColor(shipHpPct) }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Move button */}
                <div className="fleet-screen__detail-section">
                  <button
                    type="button"
                    className={`fleet-screen__move-btn${moveModeActive ? ' fleet-screen__move-btn--active' : ''}`}
                    onClick={handleMoveToggle}
                    disabled={!!inTransitInfo}
                    title={inTransitInfo ? 'Fleet is already in transit' : 'Select a destination system'}
                  >
                    {moveModeActive ? 'Select Destination...' : 'Move Fleet'}
                  </button>
                </div>
              </>
            ) : (
              <div className="fleet-screen__no-selection">
                Select a fleet from the list to view details.
              </div>
            )}
          </div>

          {/* Right: Movement orders */}
          <div className="pm-col fleet-screen__right-col">
            <div className="pm-section-label">Movement Orders</div>

            {/* Active order */}
            {inTransitInfo && (
              <div className="fleet-screen__active-order">
                <div className="fleet-screen__active-order-label">IN TRANSIT</div>
                <div className="fleet-screen__active-order-dest">
                  Destination: <strong>{inTransitInfo.destName}</strong>
                </div>
                <div className="fleet-screen__active-order-eta">
                  ETA: {inTransitInfo.etaTurns} turn{inTransitInfo.etaTurns !== 1 ? 's' : ''}
                </div>
                {activeOrder && (
                  <div className="fleet-screen__active-order-path">
                    Path: {activeOrder.path.length - 1} hop{activeOrder.path.length - 1 !== 1 ? 's' : ''} total
                  </div>
                )}
                <button
                  type="button"
                  className="fleet-screen__cancel-order-btn"
                  onClick={handleCancelMovement}
                >
                  Cancel Order
                </button>
              </div>
            )}

            {/* Destination picker */}
            {moveModeActive && selectedFleet && !inTransitInfo && (
              <div className="fleet-screen__dest-picker">
                <div className="fleet-screen__dest-picker-hint">
                  Choose a destination system:
                </div>
                {reachableSystems.length === 0 ? (
                  <div className="fleet-screen__dest-none">No reachable systems.</div>
                ) : (
                  <div className="fleet-screen__dest-list">
                    {reachableSystems.map(sys => (
                      <button
                        key={sys.id}
                        type="button"
                        className={`fleet-screen__dest-item${hoveredDestId === sys.id ? ' fleet-screen__dest-item--hovered' : ''}`}
                        onClick={() => handleMoveTo(sys.id)}
                        onMouseEnter={() => setHoveredDestId(sys.id)}
                        onMouseLeave={() => setHoveredDestId(null)}
                      >
                        <span className="fleet-screen__dest-name">{sys.name}</span>
                        <span className="fleet-screen__dest-hops">{sys.hops} hop{sys.hops !== 1 ? 's' : ''}</span>
                        <span className="fleet-screen__dest-eta">{sys.etaTurns} turn{sys.etaTurns !== 1 ? 's' : ''}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Path preview */}
            {pathPreview.length > 1 && (
              <div className="fleet-screen__path-preview">
                <div className="fleet-screen__path-preview-label">Route preview:</div>
                {pathPreview.map((sysId, i) => {
                  const name = allSystems.find(s => s.id === sysId)?.name ?? sysId;
                  return (
                    <span key={sysId} className="fleet-screen__path-step">
                      {i > 0 && <span className="fleet-screen__path-arrow">→</span>}
                      {name}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Idle hint */}
            {!moveModeActive && !inTransitInfo && (
              <div className="fleet-screen__order-idle">
                {selectedFleet
                  ? 'Fleet is idle. Use "Move Fleet" to issue a movement order.'
                  : 'Select a fleet to manage its orders.'}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
