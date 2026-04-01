/**
 * EconomyScreen — full-screen overlay showing the empire's economic overview.
 *
 * Sections:
 *  - Income Summary (top):  total credits per turn, expenses, net income with trend arrow.
 *  - Resource Stocks (middle): bar charts for all 8 resource types with production rates.
 *  - Planet Contributions (bottom): sortable table of colonies ranked by economic output.
 *  - Trade Routes (right panel): active routes with "Establish Route" controls.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { Planet } from '@nova-imperia/shared';
import type { EmpireResources } from '@nova-imperia/shared';
import {
  calculatePlanetProduction,
  calculateUpkeep,
  canEstablishTradeRoute,
  type BasicTradeRoute,
} from '@nova-imperia/shared';
import { getGameEngine } from '../../engine/GameEngine';
import { useGameEvent } from '../hooks/useGameEvents';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EconomyScreenProps {
  onClose: () => void;
  onOpenPlanet?: (planet: Planet, systemId: string) => void;
}

type SortKey = 'name' | 'system' | 'population' | 'credits' | 'minerals' | 'energy';
type SortDir = 'asc' | 'desc';

interface PlanetRow {
  planet: Planet;
  systemId: string;
  systemName: string;
  creditsProduced: number;
  mineralsProduced: number;
  energyProduced: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RESOURCE_LABELS: Record<keyof EmpireResources, string> = {
  credits: 'Credits',
  minerals: 'Minerals',
  rareElements: 'Rare Elements',
  energy: 'Energy',
  organics: 'Organics',
  exoticMaterials: 'Exotic Materials',
  faith: 'Faith',
  researchPoints: 'Research',
};

const RESOURCE_ICONS: Record<keyof EmpireResources, string> = {
  credits: 'CR',
  minerals: 'MN',
  rareElements: 'RE',
  energy: 'EN',
  organics: 'OR',
  exoticMaterials: 'EX',
  faith: 'FT',
  researchPoints: 'RP',
};

const RESOURCE_COLOURS: Record<keyof EmpireResources, string> = {
  credits: '#f5c518',
  minerals: '#a0c060',
  rareElements: '#d070e0',
  energy: '#00d4ff',
  organics: '#40c070',
  exoticMaterials: '#ff9040',
  faith: '#e0c040',
  researchPoints: '#6090ff',
};

const RESOURCE_KEYS: Array<keyof EmpireResources> = [
  'credits',
  'minerals',
  'rareElements',
  'energy',
  'organics',
  'exoticMaterials',
  'faith',
  'researchPoints',
];

const UPKEEP_LABELS = [
  { key: 'fleet', label: 'Fleet upkeep' },
  { key: 'buildings', label: 'Building maintenance' },
  { key: 'spies', label: 'Spy network' },
] as const;

// ---------------------------------------------------------------------------
// Helper: format numbers
// ---------------------------------------------------------------------------

function fmt(n: number, decimals = 0): string {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-GB', { maximumFractionDigits: decimals });
}

/** Traffic-light colour for colony health based on happiness score. */
function getHealthColor(happiness: number): string {
  if (happiness >= 70) return '#10b981'; // green
  if (happiness >= 40) return '#f59e0b'; // amber
  return '#ef4444'; // red
}

/** Client-side happiness estimate from planet buildings and population. */
function estimateHappiness(planet: Planet): number {
  if (!planet.ownerId || planet.currentPopulation <= 0) return -1;
  let score = 60;
  for (const b of planet.buildings) {
    if (b.type === 'entertainment_complex') score += 10 * b.level;
  }
  if (planet.maxPopulation > 0) {
    const density = planet.currentPopulation / planet.maxPopulation;
    if (density > 0.95) score -= 20;
    else if (density > 0.80) score -= 10;
    else if (density < 0.50) score += 10;
  }
  score -= 5;
  return Math.max(0, Math.min(100, score));
}

function sign(n: number): string {
  return n >= 0 ? `+${fmt(n)}` : fmt(n);
}

// ---------------------------------------------------------------------------
// Sub-component: resource bar
// ---------------------------------------------------------------------------

interface ResourceBarProps {
  label: string;
  icon: string;
  colour: string;
  stockpile: number;
  maxStockpile: number;
  productionPerTick: number;
}

function ResourceBar({
  label,
  icon,
  colour,
  stockpile,
  maxStockpile,
  productionPerTick,
}: ResourceBarProps): React.ReactElement {
  const pct = maxStockpile > 0 ? Math.min(1, stockpile / maxStockpile) : 0;
  const isDeficit = productionPerTick < 0;

  return (
    <div className="econ-resource-row">
      <div className="econ-resource-row__label-group">
        <span className="econ-resource-row__icon" style={{ color: colour }}>{icon}</span>
        <span className="econ-resource-row__label">{label}</span>
      </div>
      <div className="econ-resource-row__bar-wrap">
        <div
          className="econ-resource-row__bar-fill"
          style={{ width: `${pct * 100}%`, background: colour }}
        />
      </div>
      <div className="econ-resource-row__values">
        <span className="econ-resource-row__stockpile">{fmt(stockpile)}</span>
        <span
          className="econ-resource-row__rate"
          style={{ color: isDeficit ? '#ff4444' : colour }}
        >
          {sign(productionPerTick)}/turn
          {isDeficit && <span className="econ-resource-row__warn"> !</span>}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: income breakdown row
// ---------------------------------------------------------------------------

interface BreakdownRowProps {
  label: string;
  value: number;
  isExpense?: boolean;
}

function BreakdownRow({ label, value, isExpense = false }: BreakdownRowProps): React.ReactElement {
  const colour = isExpense ? '#ff7777' : value > 0 ? '#88ffcc' : '#6688aa';
  return (
    <div className="econ-breakdown-row">
      <span className="econ-breakdown-row__label">{label}</span>
      <span className="econ-breakdown-row__value" style={{ color: colour }}>
        {isExpense ? `-${fmt(Math.abs(value))}` : sign(value)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function EconomyScreen({ onClose, onOpenPlanet }: EconomyScreenProps): React.ReactElement {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); e.preventDefault(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Force re-render on each engine tick so resource figures stay current.
  const [, setTickCounter] = useState(0);
  useGameEvent('engine:tick', useCallback(() => {
    setTickCounter(prev => prev + 1);
  }, []));

  const engine = getGameEngine();
  const state = engine?.getState();
  const galaxy = state?.gameState.galaxy ?? null;
  const empires = state?.gameState.empires ?? [];
  const ships = state?.gameState.ships ?? [];
  const fleets = state?.gameState.fleets ?? [];

  // Identify the player empire (first non-AI empire, or first empire)
  const playerEmpire = empires.find(e => !e.isAI) ?? empires[0] ?? null;
  const empireId = playerEmpire?.id ?? '';

  // Gather owned planets with their system context
  const ownedPlanetRows = useMemo((): PlanetRow[] => {
    if (!galaxy || !playerEmpire) return [];
    const rows: PlanetRow[] = [];
    for (const system of galaxy.systems) {
      for (const planet of system.planets) {
        if (planet.ownerId !== empireId) continue;
        const prod = calculatePlanetProduction(planet, playerEmpire.species, playerEmpire);
        rows.push({
          planet,
          systemId: system.id,
          systemName: system.name,
          creditsProduced: prod.production.credits,
          mineralsProduced: prod.production.minerals,
          energyProduced: prod.production.energy,
        });
      }
    }
    return rows;
  }, [galaxy, playerEmpire, empireId]);

  // Aggregate empire-wide production totals
  const productionTotals = useMemo((): Partial<Record<keyof EmpireResources, number>> => {
    if (!playerEmpire) return {};
    const totals: Partial<Record<keyof EmpireResources, number>> = {};
    for (const row of ownedPlanetRows) {
      const prod = calculatePlanetProduction(row.planet, playerEmpire.species, playerEmpire);
      for (const key of RESOURCE_KEYS) {
        totals[key] = (totals[key] ?? 0) + (prod.production[key] ?? 0);
      }
    }
    return totals;
  }, [ownedPlanetRows, playerEmpire]);

  // Upkeep costs — compute fleet and building costs separately from the engine
  const upkeepTotals = useMemo(() => {
    if (!playerEmpire) {
      return { fleet: 0, buildings: 0, spies: 0, total: 0 };
    }
    const empireFleetIds = new Set(fleets.filter(f => f.empireId === empireId).map(f => f.id));
    const shipCount = ships.filter(s => s.fleetId !== null && empireFleetIds.has(s.fleetId)).length;
    const ownedPlanets = ownedPlanetRows.map(r => r.planet);

    // Fleet-only upkeep (0 buildings)
    const fleetOnly = calculateUpkeep(playerEmpire, shipCount, 0);
    const fleetCredits = Math.abs(fleetOnly.credits);

    // Full upkeep with zone-aware building maintenance
    const fullUpkeep = calculateUpkeep(playerEmpire, shipCount, 0, ownedPlanets);
    const totalCredits = Math.abs(fullUpkeep.credits);
    const buildingCredits = totalCredits - fleetCredits;

    return {
      fleet: fleetCredits,
      buildings: buildingCredits,
      spies: 0,
      total: totalCredits,
    };
  }, [playerEmpire, fleets, ships, ownedPlanetRows, empireId]);

  // Trade route income from engine state
  const tradeRoutes: BasicTradeRoute[] = useMemo(
    () => state?.tradeRoutes ?? [],
    [state],
  );

  const tradeIncome = useMemo(() => {
    let total = 0;
    for (const route of tradeRoutes) {
      if (route.empireId === empireId) {
        total += route.income;
      }
    }
    return total;
  }, [tradeRoutes, empireId]);

  // Income breakdown
  const taxIncome = useMemo(
    () => ownedPlanetRows.reduce((n, r) => {
      const prod = playerEmpire
        ? calculatePlanetProduction(r.planet, playerEmpire.species, playerEmpire)
        : null;
      return n + (prod?.taxIncome ?? 0);
    }, 0),
    [ownedPlanetRows, playerEmpire],
  );

  const buildingIncome = useMemo(
    () => (productionTotals.credits ?? 0) - taxIncome,
    [productionTotals, taxIncome],
  );

  const totalIncome = (productionTotals.credits ?? 0) + tradeIncome;
  const totalExpenses = upkeepTotals.total;
  const netIncome = totalIncome - totalExpenses;

  // Resource stockpiles
  const resources = useMemo((): EmpireResources => {
    if (!state || !empireId) {
      return { credits: 0, minerals: 0, rareElements: 0, energy: 0, organics: 0, exoticMaterials: 0, faith: 0, researchPoints: 0 };
    }
    return state.empireResourcesMap.get(empireId) ?? {
      credits: playerEmpire?.credits ?? 0,
      minerals: 0,
      rareElements: 0,
      energy: 0,
      organics: 0,
      exoticMaterials: 0,
      faith: 0,
      researchPoints: 0,
    };
  }, [state, empireId, playerEmpire]);

  // Maximum stockpile cap (for bar sizing — use a generous cap)
  const maxStockpile = useMemo((): Record<keyof EmpireResources, number> => ({
    credits: Math.max(10000, resources.credits * 1.5),
    minerals: Math.max(2000, resources.minerals * 1.5),
    rareElements: Math.max(500, resources.rareElements * 1.5),
    energy: Math.max(1000, resources.energy * 1.5),
    organics: Math.max(1000, resources.organics * 1.5),
    exoticMaterials: Math.max(500, resources.exoticMaterials * 1.5),
    faith: Math.max(500, resources.faith * 1.5),
    researchPoints: Math.max(500, resources.researchPoints * 1.5),
  }), [resources]);

  // Planet table sorting
  const [sortKey, setSortKey] = useState<SortKey>('credits');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = useCallback((key: SortKey) => {
    setSortKey(prev => {
      if (prev === key) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return key;
      }
      setSortDir('desc');
      return key;
    });
  }, []);

  const sortedRows = useMemo((): PlanetRow[] => {
    const copy = [...ownedPlanetRows];
    copy.sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case 'name': diff = a.planet.name.localeCompare(b.planet.name); break;
        case 'system': diff = a.systemName.localeCompare(b.systemName); break;
        case 'population': diff = a.planet.currentPopulation - b.planet.currentPopulation; break;
        case 'credits': diff = a.creditsProduced - b.creditsProduced; break;
        case 'minerals': diff = a.mineralsProduced - b.mineralsProduced; break;
        case 'energy': diff = a.energyProduced - b.energyProduced; break;
      }
      return sortDir === 'desc' ? -diff : diff;
    });
    return copy;
  }, [ownedPlanetRows, sortKey, sortDir]);

  // Trade route establishment UI state
  const [tradeOrigin, setTradeOrigin] = useState<string>('');
  const [tradeDest, setTradeDest] = useState<string>('');
  const [tradeError, setTradeError] = useState<string | null>(null);

  // Systems with spaceports owned by the player (eligible for trade routes)
  const eligibleSystems = useMemo((): Array<{ id: string; name: string }> => {
    if (!galaxy) return [];
    return galaxy.systems.filter(sys =>
      sys.planets.some(p => p.ownerId === empireId && p.buildings.some(b => b.type === 'spaceport')),
    ).map(sys => ({ id: sys.id, name: sys.name }));
  }, [galaxy, empireId]);

  const handleEstablishRoute = useCallback(() => {
    if (!galaxy || !tradeOrigin || !tradeDest) return;
    const check = canEstablishTradeRoute(empireId, tradeOrigin, tradeDest, galaxy);
    if (!check.allowed) {
      setTradeError(check.reason ?? 'Cannot establish trade route.');
      return;
    }
    setTradeError(null);
    // Emit to the game engine via Phaser event bus
    const game = (window as unknown as Record<string, unknown>).__EX_NIHILO_GAME__ as
      | { events: { emit: (e: string, d: unknown) => void } }
      | undefined;
    game?.events.emit('trade:establish', {
      empireId,
      originSystemId: tradeOrigin,
      destinationSystemId: tradeDest,
    });
    setTradeOrigin('');
    setTradeDest('');
  }, [galaxy, empireId, tradeOrigin, tradeDest]);

  const handleCancelRoute = useCallback((routeId: string) => {
    const game = (window as unknown as Record<string, unknown>).__EX_NIHILO_GAME__ as
      | { events: { emit: (e: string, d: unknown) => void } }
      | undefined;
    game?.events.emit('trade:cancel', { routeId });
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div
        className="pm-screen economy-screen"
        style={{ maxWidth: '1100px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="pm-header">
          <div className="pm-header__info">
            <h2 className="pm-header__name">Economy Overview</h2>
            <div className="pm-header__type">
              {ownedPlanetRows.length} planet{ownedPlanetRows.length !== 1 ? 's' : ''} colonised
              &mdash; {tradeRoutes.filter(r => r.empireId === empireId).length} trade route{tradeRoutes.filter(r => r.empireId === empireId).length !== 1 ? 's' : ''}
            </div>
          </div>
          <button
            type="button"
            className="panel-close-btn pm-header__close"
            onClick={onClose}
            aria-label="Close economy overview"
          >
            &times;
          </button>
        </div>

        {/* ── Body: three columns ── */}
        <div
          className="pm-body"
          style={{ gridTemplateColumns: '260px 1fr 280px', overflow: 'hidden' }}
        >

          {/* ── Left column: Income Summary + Resource Stocks ── */}
          <div className="pm-col pm-col--info" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Income Summary */}
            <div>
              <div className="pm-section-label">Income per turn</div>
              <BreakdownRow label="Taxation" value={taxIncome} />
              <BreakdownRow label="Buildings" value={buildingIncome} />
              <BreakdownRow label="Trade routes" value={tradeIncome} />
              <div className="pm-divider" />
              <BreakdownRow label="Total income" value={totalIncome} />
            </div>

            <div>
              <div className="pm-section-label">Expenses per turn</div>
              {UPKEEP_LABELS.map(({ key, label }) => (
                <BreakdownRow
                  key={key}
                  label={label}
                  value={upkeepTotals[key]}
                  isExpense
                />
              ))}
              <div className="pm-divider" />
              <BreakdownRow label="Total expenses" value={totalExpenses} isExpense />
            </div>

            <div className="econ-net-income" style={{ color: netIncome >= 0 ? '#88ffcc' : '#ff6666' }}>
              <span className="econ-net-income__label">Net income</span>
              <span className="econ-net-income__value">
                {sign(netIncome)} CR/turn
                {netIncome > 0 ? ' ▲' : netIncome < 0 ? ' ▼' : ''}
              </span>
            </div>

            {/* Resource Stocks */}
            <div>
              <div className="pm-section-label">Resource stockpiles</div>
              {RESOURCE_KEYS.map(key => (
                <ResourceBar
                  key={key}
                  label={RESOURCE_LABELS[key]}
                  icon={RESOURCE_ICONS[key]}
                  colour={RESOURCE_COLOURS[key]}
                  stockpile={resources[key]}
                  maxStockpile={maxStockpile[key]}
                  productionPerTick={productionTotals[key] ?? 0}
                />
              ))}
            </div>
          </div>

          {/* ── Centre column: Planet Contributions table ── */}
          <div
            className="pm-col"
            style={{ display: 'flex', flexDirection: 'column', gap: '0', overflow: 'hidden' }}
          >
            <div className="pm-section-label">Planet Contributions</div>
            {ownedPlanetRows.length === 0 ? (
              <div style={{ color: 'var(--color-text-muted)', fontSize: '12px', padding: '12px 0' }}>
                No colonies yet. Colonise a planet to see contributions here.
              </div>
            ) : (
              <div style={{ flex: 1, overflow: 'auto' }}>
                <table className="econ-planet-table">
                  <thead>
                    <tr>
                      {(
                        [
                          ['name', 'Planet'],
                          ['system', 'System'],
                          ['population', 'Pop'],
                          ['credits', 'CR/turn'],
                          ['minerals', 'MN/turn'],
                          ['energy', 'EN/turn'],
                        ] as Array<[SortKey, string]>
                      ).map(([key, label]) => (
                        <th
                          key={key}
                          className={`econ-planet-table__th${sortKey === key ? ' econ-planet-table__th--active' : ''}`}
                          onClick={() => handleSort(key)}
                          title={`Sort by ${label}`}
                        >
                          {label}
                          {sortKey === key && (
                            <span className="econ-planet-table__sort-arrow">
                              {sortDir === 'desc' ? ' ↓' : ' ↑'}
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row) => (
                      <tr
                        key={row.planet.id}
                        className="econ-planet-table__row"
                        onClick={() => onOpenPlanet?.(row.planet, row.systemId)}
                        style={{ cursor: onOpenPlanet ? 'pointer' : 'default' }}
                        title={onOpenPlanet ? `Open ${row.planet.name}` : undefined}
                      >
                        <td className="econ-planet-table__td econ-planet-table__td--name">
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {(() => {
                              const hp = estimateHappiness(row.planet);
                              if (hp < 0) return null;
                              return (
                                <span
                                  title={`Colony health: ${hp}`}
                                  style={{
                                    display: 'inline-block',
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: getHealthColor(hp),
                                    flexShrink: 0,
                                  }}
                                />
                              );
                            })()}
                            {row.planet.name}
                            {row.planet.maxPopulation > 0 && row.planet.currentPopulation / row.planet.maxPopulation > 0.95 && (
                              <span
                                title="Overcrowded"
                                style={{
                                  fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase',
                                  padding: '0px 3px', borderRadius: '2px',
                                  background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444',
                                  marginLeft: '2px',
                                }}
                              >
                                !
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="econ-planet-table__td econ-planet-table__td--muted">
                          {row.systemName}
                        </td>
                        <td className="econ-planet-table__td econ-planet-table__td--num">
                          {row.planet.currentPopulation > 0
                            ? `${(row.planet.currentPopulation / 1_000_000).toFixed(1)}M`
                            : '—'}
                        </td>
                        <td
                          className="econ-planet-table__td econ-planet-table__td--num"
                          style={{ color: RESOURCE_COLOURS.credits }}
                        >
                          {fmt(row.creditsProduced)}
                        </td>
                        <td
                          className="econ-planet-table__td econ-planet-table__td--num"
                          style={{ color: RESOURCE_COLOURS.minerals }}
                        >
                          {fmt(row.mineralsProduced)}
                        </td>
                        <td
                          className="econ-planet-table__td econ-planet-table__td--num"
                          style={{ color: row.energyProduced < 0 ? '#ff4444' : RESOURCE_COLOURS.energy }}
                        >
                          {sign(row.energyProduced)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Right column: Trade Routes ── */}
          <div className="pm-col pm-col--production" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            <div className="pm-section-label">
              Trade Routes
              <span className="pm-section-label__count">
                {tradeRoutes.filter(r => r.empireId === empireId).length}
              </span>
            </div>

            {/* Existing routes */}
            {tradeRoutes.filter(r => r.empireId === empireId).length === 0 ? (
              <div style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>
                No active trade routes. Establish a route between two systems that both have spaceports.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {tradeRoutes
                  .filter(r => r.empireId === empireId)
                  .map(route => {
                    const originSys = galaxy?.systems.find(s => s.id === route.originSystemId);
                    const destSys = galaxy?.systems.find(s => s.id === route.destinationSystemId);
                    return (
                      <div key={route.id} className="econ-trade-route-card">
                        <div className="econ-trade-route-card__path">
                          <span className="econ-trade-route-card__system">
                            {originSys?.name ?? route.originSystemId}
                          </span>
                          <span className="econ-trade-route-card__arrow"> &#8594; </span>
                          <span className="econ-trade-route-card__system">
                            {destSys?.name ?? route.destinationSystemId}
                          </span>
                        </div>
                        <div className="econ-trade-route-card__income">
                          +{fmt(route.income)} CR/turn
                        </div>
                        <button
                          type="button"
                          className="econ-trade-route-card__cancel speed-btn"
                          onClick={() => handleCancelRoute(route.id)}
                          title="Cancel this trade route"
                        >
                          Cancel
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}

            <div className="pm-divider" />

            {/* Establish new route */}
            <div className="pm-section-label">Establish Route</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label className="econ-trade-label" htmlFor="trade-origin">
                Origin system
              </label>
              <select
                id="trade-origin"
                className="econ-trade-select"
                value={tradeOrigin}
                onChange={(e) => { setTradeOrigin(e.target.value); setTradeError(null); }}
              >
                <option value="">— select —</option>
                {eligibleSystems.map(sys => (
                  <option key={sys.id} value={sys.id}>{sys.name}</option>
                ))}
              </select>

              <label className="econ-trade-label" htmlFor="trade-dest">
                Destination system
              </label>
              <select
                id="trade-dest"
                className="econ-trade-select"
                value={tradeDest}
                onChange={(e) => { setTradeDest(e.target.value); setTradeError(null); }}
              >
                <option value="">— select —</option>
                {eligibleSystems
                  .filter(sys => sys.id !== tradeOrigin)
                  .map(sys => (
                    <option key={sys.id} value={sys.id}>{sys.name}</option>
                  ))}
              </select>

              {tradeError && (
                <div className="econ-trade-error">{tradeError}</div>
              )}

              <button
                type="button"
                className="speed-btn"
                style={{ width: '100%', marginTop: '4px' }}
                disabled={!tradeOrigin || !tradeDest}
                onClick={handleEstablishRoute}
                title="Establish trade route (requires spaceports at both ends)"
              >
                Establish Route
              </button>

              {eligibleSystems.length < 2 && (
                <div style={{ color: 'var(--color-text-muted)', fontSize: '10px', marginTop: '4px' }}>
                  You need at least two systems with spaceports to establish a trade route.
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
