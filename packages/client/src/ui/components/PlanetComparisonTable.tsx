import React, { useState, useMemo, useCallback } from 'react';
import type { PlanetDemographics } from '@nova-imperia/shared';
import { getSettlementTier, SETTLEMENT_TIER_THRESHOLDS } from '@nova-imperia/shared';
import { PlanetHealthDot } from './PlanetHealthDot';
import type { AlertType } from './DemographicsPanel';

// ── Types ───────────────────────────────────────────────────────────────────

/** Data needed per planet row in the comparison table. */
export interface PlanetComparisonEntry {
  /** Unique planet identifier. */
  planetId: string;
  /** Display name of the planet. */
  name: string;
  /** Full demographics snapshot. */
  demographics: PlanetDemographics;
  /** Growth rate as fraction per tick. */
  growthRate?: number;
  /** Active alerts for this planet. */
  alerts?: AlertType[];
}

export type SortField =
  | 'name'
  | 'population'
  | 'growth'
  | 'happiness'
  | 'employment'
  | 'housing'
  | 'tier'
  | 'species'
  | 'alerts';

export type FilterMode = 'all' | 'problems' | string;  // string = tier filter

export interface PlanetComparisonTableProps {
  /** Array of all colonised planets with demographics. */
  planets: PlanetComparisonEntry[];
  /** Callback when a planet row is clicked. */
  onPlanetSelect?: (planetId: string) => void;
}

// ── Colour palette (matching dark theme) ────────────────────────────────────

const C = {
  bg: '#0a0e17',
  card: '#111827',
  border: '#1e2d3d',
  accent: '#00d4ff',
  text: '#ccdde8',
  label: '#8899aa',
  heading: '#aabbcc',
  muted: '#556677',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  rowHover: 'rgba(0, 212, 255, 0.05)',
  headerBg: '#0d1420',
} as const;

// ── Alert colours ───────────────────────────────────────────────────────────

const ALERT_COLOURS: Record<string, string> = {
  UNEMPLOYED: '#f59e0b',
  HOUSING: '#f97316',
  UNREST: '#ef4444',
  DISEASE: '#a855f7',
  STARVATION: '#ef4444',
  CRIME: '#f59e0b',
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatPop(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function getHappiness(d: PlanetDemographics): number {
  const { loyal, content, disgruntled, rebellious } = d.loyalty;
  const total = loyal + content + disgruntled + rebellious;
  if (total === 0) return 50;
  return (loyal * 100 + content * 70 + disgruntled * 30 + rebellious * 5) / total;
}

function getEmploymentRate(d: PlanetDemographics): number {
  if (!d.employment) return 1;
  return 1 - d.employment.unemploymentRate;
}

function getTierLabel(population: number): string {
  const tier = getSettlementTier(population);
  return SETTLEMENT_TIER_THRESHOLDS[tier].name;
}

function getTierOrder(population: number): number {
  const tier = getSettlementTier(population);
  const order = ['habitat', 'settlement', 'colony', 'small_city', 'city', 'metropolis', 'megatropolis', 'planetary'];
  return order.indexOf(tier);
}

function hasProblem(entry: PlanetComparisonEntry): boolean {
  if (entry.alerts && entry.alerts.length > 0) return true;
  const happiness = getHappiness(entry.demographics);
  if (happiness < 40) return true;
  if (entry.demographics.employment && entry.demographics.employment.unemploymentRate > 0.15) return true;
  return false;
}

// ── Column definitions ──────────────────────────────────────────────────────

interface ColumnDef {
  field: SortField;
  label: string;
  width: string;
  align?: 'left' | 'center' | 'right';
}

const COLUMNS: ColumnDef[] = [
  { field: 'name', label: 'Name', width: '18%', align: 'left' },
  { field: 'population', label: 'Population', width: '12%', align: 'right' },
  { field: 'growth', label: 'Growth', width: '10%', align: 'right' },
  { field: 'happiness', label: 'Health', width: '8%', align: 'center' },
  { field: 'employment', label: 'Employment', width: '11%', align: 'right' },
  { field: 'tier', label: 'Tier', width: '12%', align: 'left' },
  { field: 'species', label: 'Species', width: '14%', align: 'left' },
  { field: 'alerts', label: 'Alerts', width: '15%', align: 'left' },
];

// ── Styles ──────────────────────────────────────────────────────────────────

const S_CONTAINER: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  fontSize: '11px',
  color: C.text,
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: '4px',
  overflow: 'hidden',
};

const S_TOOLBAR: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 8px',
  borderBottom: `1px solid ${C.border}`,
  background: C.headerBg,
  flexWrap: 'wrap',
};

const S_FILTER_BTN: (active: boolean) => React.CSSProperties = (active) => ({
  padding: '2px 8px',
  borderRadius: '3px',
  border: `1px solid ${active ? C.accent : C.border}`,
  background: active ? `${C.accent}22` : 'transparent',
  color: active ? C.accent : C.label,
  fontSize: '10px',
  fontWeight: active ? 700 : 400,
  cursor: 'pointer',
  fontFamily: 'inherit',
});

const S_HEADER_ROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '4px 8px',
  background: C.headerBg,
  borderBottom: `1px solid ${C.border}`,
  position: 'sticky',
  top: 0,
  zIndex: 1,
};

const S_HEADER_CELL: (col: ColumnDef) => React.CSSProperties = (col) => ({
  width: col.width,
  fontSize: '9px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
  color: C.heading,
  textAlign: col.align ?? 'left',
  cursor: 'pointer',
  userSelect: 'none',
  padding: '2px 4px',
});

const S_DATA_ROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '4px 8px',
  borderBottom: `1px solid ${C.border}33`,
  cursor: 'pointer',
  transition: 'background 0.15s',
};

const S_CELL: (col: ColumnDef) => React.CSSProperties = (col) => ({
  width: col.width,
  textAlign: col.align ?? 'left',
  padding: '2px 4px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const S_SCROLL: React.CSSProperties = {
  overflowY: 'auto',
  maxHeight: '400px',
};

const S_BADGE: (colour: string) => React.CSSProperties = (colour) => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0px 4px',
  borderRadius: '2px',
  fontSize: '8px',
  fontWeight: 700,
  background: `${colour}22`,
  color: colour,
  border: `1px solid ${colour}44`,
  marginRight: '2px',
});

// ── Sort function ───────────────────────────────────────────────────────────

function getSortValue(entry: PlanetComparisonEntry, field: SortField): string | number {
  switch (field) {
    case 'name':
      return entry.name.toLowerCase();
    case 'population':
      return entry.demographics.totalPopulation;
    case 'growth':
      return entry.growthRate ?? 0;
    case 'happiness':
      return getHappiness(entry.demographics);
    case 'employment':
      return getEmploymentRate(entry.demographics);
    case 'tier':
      return getTierOrder(entry.demographics.totalPopulation);
    case 'species':
      return entry.demographics.primarySpeciesId.toLowerCase();
    case 'alerts':
      return entry.alerts?.length ?? 0;
    default:
      return 0;
  }
}

// ── Tier filter options ─────────────────────────────────────────────────────

const TIER_FILTERS = ['Habitat', 'Settlement', 'Colony', 'Small City', 'City', 'Metropolis', 'Megatropolis', 'Planetary'];

// ── Component ───────────────────────────────────────────────────────────────

/**
 * Empire-wide sortable planet comparison table.
 *
 * Displays all colonised planets in a compact, scrollable table with
 * sortable column headers and filter options. Each row shows key
 * demographics at a glance with health dots and alert badges.
 */
export function PlanetComparisonTable({
  planets,
  onPlanetSelect,
}: PlanetComparisonTableProps): React.ReactElement {
  const [sortField, setSortField] = useState<SortField>('population');
  const [sortAsc, setSortAsc] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const handleSort = useCallback((field: SortField) => {
    if (field === sortField) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'name'); // Default asc for name, desc for everything else
    }
  }, [sortField, sortAsc]);

  // Filter and sort
  const sortedPlanets = useMemo((): PlanetComparisonEntry[] => {
    let filtered = planets;

    if (filter === 'problems') {
      filtered = planets.filter(hasProblem);
    } else if (filter !== 'all') {
      // Tier filter
      filtered = planets.filter((p) =>
        getTierLabel(p.demographics.totalPopulation).toLowerCase() === filter.toLowerCase()
      );
    }

    return [...filtered].sort((a, b) => {
      const aVal = getSortValue(a, sortField);
      const bVal = getSortValue(b, sortField);
      let cmp: number;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        cmp = aVal.localeCompare(bVal);
      } else {
        cmp = (aVal as number) - (bVal as number);
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [planets, filter, sortField, sortAsc]);

  // Sort direction indicator
  const sortArrow = (field: SortField): string => {
    if (field !== sortField) return '';
    return sortAsc ? ' \u25B2' : ' \u25BC';
  };

  return (
    <div style={S_CONTAINER} className="planet-comparison-table">
      {/* Toolbar: filters */}
      <div style={S_TOOLBAR}>
        <span style={{ fontSize: '10px', color: C.label, fontWeight: 700 }}>Filter:</span>
        <button style={S_FILTER_BTN(filter === 'all')} onClick={() => setFilter('all')}>All</button>
        <button style={S_FILTER_BTN(filter === 'problems')} onClick={() => setFilter('problems')}>Problems Only</button>
        {TIER_FILTERS.map((tier) => {
          // Only show tier filter if at least one planet has that tier
          const hasAny = planets.some((p) => getTierLabel(p.demographics.totalPopulation) === tier);
          if (!hasAny) return null;
          return (
            <button
              key={tier}
              style={S_FILTER_BTN(filter.toLowerCase() === tier.toLowerCase())}
              onClick={() => setFilter(tier)}
            >
              {tier}
            </button>
          );
        })}
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: C.muted }}>
          {sortedPlanets.length} / {planets.length} planets
        </span>
      </div>

      {/* Header row */}
      <div style={S_HEADER_ROW}>
        {COLUMNS.map((col) => (
          <div
            key={col.field}
            style={S_HEADER_CELL(col)}
            onClick={() => handleSort(col.field)}
          >
            {col.label}{sortArrow(col.field)}
          </div>
        ))}
      </div>

      {/* Data rows (scrollable) */}
      <div style={S_SCROLL}>
        {sortedPlanets.length === 0 ? (
          <div style={{ padding: '12px', textAlign: 'center', color: C.muted, fontStyle: 'italic' }}>
            No planets match the current filter
          </div>
        ) : (
          sortedPlanets.map((entry: PlanetComparisonEntry) => {
            const d = entry.demographics;
            const happiness = getHappiness(d);
            const empRate = getEmploymentRate(d);
            const empColour = empRate > 0.95 ? C.green : empRate > 0.85 ? C.amber : C.red;
            const growthColour = (entry.growthRate ?? 0) > 0 ? C.green : (entry.growthRate ?? 0) < 0 ? C.red : C.muted;
            const isHovered = hoveredRow === entry.planetId;

            return (
              <div
                key={entry.planetId}
                style={{
                  ...S_DATA_ROW,
                  background: isHovered ? C.rowHover : 'transparent',
                }}
                onClick={() => onPlanetSelect?.(entry.planetId)}
                onMouseEnter={() => setHoveredRow(entry.planetId)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                {/* Name */}
                <div style={{ ...S_CELL(COLUMNS[0]), fontWeight: 600, color: C.text }}>
                  {entry.name}
                </div>

                {/* Population */}
                <div style={{ ...S_CELL(COLUMNS[1]), fontWeight: 600 }}>
                  {formatPop(d.totalPopulation)}
                </div>

                {/* Growth */}
                <div style={{ ...S_CELL(COLUMNS[2]), color: growthColour, fontWeight: 600 }}>
                  {entry.growthRate !== undefined
                    ? `${entry.growthRate >= 0 ? '+' : ''}${(entry.growthRate * 100).toFixed(1)}%`
                    : '--'}
                </div>

                {/* Happiness (health dot) */}
                <div style={{ ...S_CELL(COLUMNS[3]), display: 'flex', justifyContent: 'center' }}>
                  <PlanetHealthDot value={happiness} size={10} />
                </div>

                {/* Employment */}
                <div style={{ ...S_CELL(COLUMNS[4]), color: empColour, fontWeight: 600 }}>
                  {d.employment ? `${(empRate * 100).toFixed(0)}%` : '--'}
                </div>

                {/* Settlement tier */}
                <div style={{ ...S_CELL(COLUMNS[5]), color: C.label }}>
                  {getTierLabel(d.totalPopulation)}
                </div>

                {/* Dominant species */}
                <div style={{ ...S_CELL(COLUMNS[6]), color: C.label }}>
                  {d.primarySpeciesId}
                </div>

                {/* Alerts */}
                <div style={{ ...S_CELL(COLUMNS[7]), display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                  {entry.alerts && entry.alerts.length > 0
                    ? entry.alerts.map((a: AlertType) => (
                        <span key={a} style={S_BADGE(ALERT_COLOURS[a] ?? C.amber)}>
                          {a}
                        </span>
                      ))
                    : <span style={{ color: C.muted, fontSize: '9px' }}>{'\u2014'}</span>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
