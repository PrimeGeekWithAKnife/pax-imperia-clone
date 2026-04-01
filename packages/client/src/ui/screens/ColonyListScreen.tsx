/**
 * ColonyListScreen -- full-screen overlay showing all the player's colonies
 * in a sortable table with quick navigation to planet management.
 *
 * Follows the same overlay pattern as EconomyScreen: dark semi-transparent
 * backdrop, pm-screen container, pm-header, pm-body layout.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { Planet } from '@nova-imperia/shared';
import { calculatePlanetProduction } from '@nova-imperia/shared';
import { getGameEngine } from '../../engine/GameEngine';
import { useGameEvent } from '../hooks/useGameEvents';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ColonyListScreenProps {
  onClose: () => void;
  onOpenPlanet?: (planet: Planet, systemId: string) => void;
}

type SortKey = 'name' | 'system' | 'population' | 'income' | 'queue';
type SortDir = 'asc' | 'desc';

interface ColonyRow {
  planet: Planet;
  systemId: string;
  systemName: string;
  population: number;
  creditsIncome: number;
  queueLabel: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format population as K/M with one decimal. */
function formatPop(n: number): string {
  if (n <= 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.floor(n)}`;
}

/** Format credits with sign and locale separator. */
function formatCredits(n: number): string {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('en-GB', { maximumFractionDigits: 0 });
  return n >= 0 ? `+${formatted} CR` : `-${formatted} CR`;
}

/** Derive the first construction queue item label, or "Idle". */
function getQueueLabel(planet: Planet): string {
  if (!planet.productionQueue || planet.productionQueue.length === 0) return 'Idle';
  const first = planet.productionQueue[0];
  // Use a readable name derived from the templateId
  const raw = first.templateId;
  // Convert snake_case to Title Case (e.g. "entertainment_complex" -> "Entertainment Complex")
  return raw
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Sort header sub-component
// ---------------------------------------------------------------------------

interface SortHeaderProps {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}

function SortHeader({ label, sortKey, currentKey, currentDir, onSort, align = 'left' }: SortHeaderProps): React.ReactElement {
  const isActive = currentKey === sortKey;
  return (
    <th
      className={`econ-planet-table__th${isActive ? ' econ-planet-table__th--active' : ''}`}
      onClick={() => onSort(sortKey)}
      title={`Sort by ${label}`}
      style={{ textAlign: align, cursor: 'pointer', userSelect: 'none' }}
    >
      {label}
      {isActive && (
        <span className="econ-planet-table__sort-arrow">
          {currentDir === 'desc' ? ' \u2193' : ' \u2191'}
        </span>
      )}
    </th>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ColonyListScreen({ onClose, onOpenPlanet }: ColonyListScreenProps): React.ReactElement {
  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); e.preventDefault(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Re-render on each engine tick so figures stay current
  const [, setTickCounter] = useState(0);
  useGameEvent('engine:tick', useCallback(() => {
    setTickCounter(prev => prev + 1);
  }, []));

  const engine = getGameEngine();
  const state = engine?.getState();
  const galaxy = state?.gameState.galaxy ?? null;
  const empires = state?.gameState.empires ?? [];

  // Identify the player empire
  const playerEmpire = empires.find(e => !e.isAI) ?? empires[0] ?? null;
  const empireId = playerEmpire?.id ?? '';

  // Build colony rows
  const colonyRows = useMemo((): ColonyRow[] => {
    if (!galaxy || !playerEmpire) return [];
    const rows: ColonyRow[] = [];
    for (const system of galaxy.systems) {
      for (const planet of system.planets) {
        if (planet.ownerId !== empireId) continue;
        const prod = calculatePlanetProduction(planet, playerEmpire.species, playerEmpire);
        rows.push({
          planet,
          systemId: system.id,
          systemName: system.name,
          population: planet.currentPopulation,
          creditsIncome: prod.production.credits,
          queueLabel: getQueueLabel(planet),
        });
      }
    }
    return rows;
  }, [galaxy, playerEmpire, empireId]);

  // Sort state
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = useCallback((key: SortKey) => {
    setSortKey(prev => {
      if (prev === key) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return key;
      }
      setSortDir(key === 'name' || key === 'system' ? 'asc' : 'desc');
      return key;
    });
  }, []);

  const sortedRows = useMemo((): ColonyRow[] => {
    const copy = [...colonyRows];
    copy.sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case 'name': diff = a.planet.name.localeCompare(b.planet.name); break;
        case 'system': diff = a.systemName.localeCompare(b.systemName); break;
        case 'population': diff = a.population - b.population; break;
        case 'income': diff = a.creditsIncome - b.creditsIncome; break;
        case 'queue': diff = a.queueLabel.localeCompare(b.queueLabel); break;
      }
      return sortDir === 'desc' ? -diff : diff;
    });
    return copy;
  }, [colonyRows, sortKey, sortDir]);

  // Aggregate totals
  const totalPop = colonyRows.reduce((s, r) => s + r.population, 0);
  const totalIncome = colonyRows.reduce((s, r) => s + r.creditsIncome, 0);
  const colonyCount = colonyRows.length;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div
        className="pm-screen colony-list-screen"
        style={{ maxWidth: '900px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="pm-header">
          <div className="pm-header__info">
            <h2 className="pm-header__name">Colony Overview</h2>
            <div className="pm-header__type">
              {colonyCount} colon{colonyCount !== 1 ? 'ies' : 'y'} across the empire
            </div>
          </div>
          <button
            type="button"
            className="panel-close-btn pm-header__close"
            onClick={onClose}
            aria-label="Close colony overview"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="pm-body" style={{ display: 'flex', flexDirection: 'column', gap: '0', overflow: 'hidden' }}>
          {colonyRows.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '12px', padding: '24px 16px', textAlign: 'center' }}>
              No colonies yet. Colonise a planet to see your empire&apos;s holdings here.
            </div>
          ) : (
            <>
              {/* Scrollable table */}
              <div style={{ flex: 1, overflow: 'auto', padding: '0 16px' }}>
                <table className="econ-planet-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <SortHeader label="Planet" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                      <SortHeader label="System" sortKey="system" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                      <SortHeader label="Pop" sortKey="population" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                      <SortHeader label="Income" sortKey="income" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                      <SortHeader label="Queue" sortKey="queue" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                      <th className="econ-planet-table__th" style={{ width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row) => (
                      <tr
                        key={row.planet.id}
                        className="econ-planet-table__row"
                        style={{ cursor: onOpenPlanet ? 'pointer' : 'default' }}
                        onClick={() => onOpenPlanet?.(row.planet, row.systemId)}
                        title={onOpenPlanet ? `Manage ${row.planet.name}` : undefined}
                      >
                        <td className="econ-planet-table__td econ-planet-table__td--name">
                          {row.planet.name}
                        </td>
                        <td className="econ-planet-table__td econ-planet-table__td--muted">
                          {row.systemName}
                        </td>
                        <td className="econ-planet-table__td econ-planet-table__td--num" style={{ textAlign: 'right' }}>
                          {formatPop(row.population)}
                        </td>
                        <td
                          className="econ-planet-table__td econ-planet-table__td--num"
                          style={{
                            textAlign: 'right',
                            color: row.creditsIncome >= 0 ? '#f5c518' : '#ff4444',
                          }}
                        >
                          {formatCredits(row.creditsIncome)}
                        </td>
                        <td
                          className="econ-planet-table__td"
                          style={{
                            color: row.queueLabel === 'Idle' ? '#f59e0b' : 'var(--color-text)',
                            fontStyle: row.queueLabel === 'Idle' ? 'italic' : 'normal',
                          }}
                        >
                          {row.queueLabel}
                        </td>
                        <td className="econ-planet-table__td" style={{ textAlign: 'center' }}>
                          {onOpenPlanet && (
                            <span
                              style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}
                              aria-label={`Open ${row.planet.name}`}
                            >
                              &rarr;
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Empire totals footer */}
              <div
                className="colony-list-screen__totals"
                style={{
                  display: 'flex',
                  gap: '24px',
                  justifyContent: 'center',
                  padding: '12px 16px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                  fontSize: '12px',
                  color: 'var(--color-text-muted)',
                }}
              >
                <span>
                  <strong style={{ color: 'var(--color-text)' }}>{formatPop(totalPop)}</strong> total population
                </span>
                <span>
                  <strong style={{ color: '#f5c518' }}>{formatCredits(totalIncome)}</strong>/turn
                </span>
                <span>
                  <strong style={{ color: 'var(--color-text)' }}>{colonyCount}</strong> colon{colonyCount !== 1 ? 'ies' : 'y'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
