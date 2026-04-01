/**
 * MarketScreen — full-screen overlay for the commodity marketplace.
 *
 * Sections:
 *  - Market Summary Bar (top): credits balance, inflation rate, trade routes, market access.
 *  - Commodity Table (left/centre): all commodities with sortable columns and category filter.
 *  - Price Chart Area (centre-right): placeholder for selected commodity price history.
 *  - Trade Actions Panel (right): buy/sell controls for the selected commodity.
 *  - Sanctions Panel (bottom-right): any active sanctions against the player.
 *
 * All data arrives via props — the component does not import engine functions directly.
 */

import React, { useState, useCallback, useMemo } from 'react';

// ---------------------------------------------------------------------------
// Types — self-contained so the component can be rendered with mock data
// ---------------------------------------------------------------------------

export type CommodityCategory = 'common' | 'rare' | 'ultra_rare';
export type MarketTrend = 'rising' | 'falling' | 'stable';
export type MarketAccessLevel = 'local' | 'galactic';

export interface CommodityRow {
  /** Unique commodity identifier (snake_case). */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Rarity tier. */
  category: CommodityCategory;
  /** Current per-unit price on the market. */
  currentPrice: number;
  /** Baseline price in credits. */
  basePrice: number;
  /** Available supply units on the market. */
  supply: number;
  /** Aggregate demand from empires. */
  demand: number;
  /** Recent price direction. */
  trend: MarketTrend;
  /** Rolling price history (most recent last) for chart rendering. */
  priceHistory: number[];
}

export interface Sanction {
  /** Empire name that imposed the sanction. */
  imposedBy: string;
  /** Commodity IDs blocked by this sanction, if any. */
  blockedCommodities: string[];
}

export interface MarketScreenProps {
  /** Player's current credits balance. */
  credits: number;
  /** Current inflation rate (1.0 = no inflation). */
  inflationRate: number;
  /** Number of active trade routes for the player. */
  activeTradeRoutes: number;
  /** Player's market access level. */
  marketAccess: MarketAccessLevel;
  /** All commodity listings. */
  commodities: CommodityRow[];
  /** Per-commodity stockpile for the player empire keyed by commodity ID. */
  stockpiles: Record<string, number>;
  /** Active sanctions against the player. */
  sanctions: Sanction[];
  /** Callback when the player places a buy order. */
  onBuy?: (commodityId: string, quantity: number) => void;
  /** Callback when the player places a sell order. */
  onSell?: (commodityId: string, quantity: number) => void;
  /** Close the screen. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

type SortKey = 'name' | 'category' | 'currentPrice' | 'basePrice' | 'change' | 'supply' | 'demand' | 'trend';
type SortDir = 'asc' | 'desc';

type CategoryFilter = 'all' | CommodityCategory;

// ---------------------------------------------------------------------------
// Style constants — matching the dark sci-fi aesthetic
// ---------------------------------------------------------------------------

const COLOURS = {
  bg:           '#0a0e17',
  card:         '#111827',
  cardHover:    '#162033',
  border:       '#1e2d3d',
  borderBright: '#2a4060',
  accent:       '#00d4ff',
  accentDim:    'rgba(0, 212, 255, 0.3)',
  text:         '#c8d6e5',
  textMuted:    '#5a7080',
  textBright:   '#e8f0ff',
  green:        '#44ff88',
  yellow:       '#f5c518',
  red:          '#ff4444',
  purple:       '#b060ff',
  blue:         '#6090ff',
  grey:         '#8899aa',
  rowSelected:  'rgba(0, 212, 255, 0.08)',
  rowHover:     'rgba(0, 212, 255, 0.04)',
} as const;

const CATEGORY_COLOURS: Record<CommodityCategory, string> = {
  common:    COLOURS.grey,
  rare:      COLOURS.blue,
  ultra_rare: COLOURS.purple,
};

const CATEGORY_LABELS: Record<CommodityCategory, string> = {
  common:    'Common',
  rare:      'Rare',
  ultra_rare: 'Ultra-Rare',
};

const TREND_ICONS: Record<MarketTrend, string> = {
  rising:  '\u25B2', // ▲
  falling: '\u25BC', // ▼
  stable:  '\u25C6', // ◆
};

const TREND_COLOURS: Record<MarketTrend, string> = {
  rising:  COLOURS.green,
  falling: COLOURS.red,
  stable:  COLOURS.textMuted,
};

const CATEGORY_ORDER: Record<CommodityCategory, number> = {
  common: 0,
  rare: 1,
  ultra_rare: 2,
};

// ---------------------------------------------------------------------------
// Helper: format numbers
// ---------------------------------------------------------------------------

function fmt(n: number, decimals = 0): string {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-GB', { maximumFractionDigits: decimals });
}

function pctChange(current: number, base: number): number {
  if (base === 0) return 0;
  return ((current - base) / base) * 100;
}

// ---------------------------------------------------------------------------
// Inline style helpers
// ---------------------------------------------------------------------------

const styles = {
  overlay: {
    position: 'absolute' as const,
    inset: 0,
    background: 'rgba(5, 5, 15, 0.94)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto' as const,
    userSelect: 'none' as const,
    zIndex: 200,
    overflow: 'hidden',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  },
  screen: {
    display: 'flex',
    flexDirection: 'column' as const,
    width: 'min(1340px, 98vw)',
    height: 'min(880px, 96vh)',
    background: 'rgba(6, 6, 18, 0.99)',
    border: `1px solid ${COLOURS.borderBright}`,
    boxShadow: `0 0 80px rgba(0, 212, 255, 0.07), 0 0 140px rgba(0, 0, 0, 0.9)`,
    overflow: 'hidden',
  },
  header: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px 20px 12px',
    borderBottom: `1px solid ${COLOURS.border}`,
    background: 'rgba(0, 25, 45, 0.45)',
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: '18px',
    fontWeight: 'normal' as const,
    color: COLOURS.textBright,
    letterSpacing: '0.14em',
    margin: 0,
    textTransform: 'uppercase' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  headerSubtitle: {
    fontSize: '11px',
    color: COLOURS.textMuted,
    letterSpacing: '0.08em',
    marginTop: '2px',
  },
  closeBtn: {
    background: 'none',
    border: `1px solid ${COLOURS.border}`,
    color: COLOURS.textMuted,
    fontSize: '16px',
    width: '32px',
    height: '32px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.15s',
  },
  // Summary bar
  summaryBar: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    padding: '10px 20px',
    borderBottom: `1px solid ${COLOURS.border}`,
    background: 'rgba(0, 15, 30, 0.5)',
    fontSize: '11px',
    letterSpacing: '0.06em',
  },
  summaryItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  summaryLabel: {
    color: COLOURS.textMuted,
    textTransform: 'uppercase' as const,
    fontSize: '9px',
    letterSpacing: '0.15em',
  },
  summaryValue: {
    color: COLOURS.text,
    fontSize: '13px',
    fontWeight: 600,
  },
  // Body
  body: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '1fr 340px',
    overflow: 'hidden',
    minHeight: 0,
  },
  // Left column: table
  leftCol: {
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    borderRight: `1px solid ${COLOURS.border}`,
  },
  // Right column: chart + trade + sanctions
  rightCol: {
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'auto',
    background: 'rgba(5, 5, 14, 0.5)',
    padding: '16px 14px',
    gap: '16px',
  },
  // Filter bar
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderBottom: `1px solid ${COLOURS.border}`,
    background: 'rgba(5, 5, 14, 0.6)',
    flexShrink: 0,
  },
  filterBtn: (active: boolean) => ({
    background: active ? 'rgba(0, 212, 255, 0.12)' : 'transparent',
    border: `1px solid ${active ? COLOURS.accent : COLOURS.border}`,
    color: active ? COLOURS.accent : COLOURS.textMuted,
    padding: '4px 10px',
    fontSize: '10px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    transition: 'all 0.15s',
  }),
  // Table
  tableWrap: {
    flex: 1,
    overflow: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '11px',
  },
  th: (active: boolean) => ({
    padding: '8px 10px',
    textAlign: 'left' as const,
    fontSize: '9px',
    letterSpacing: '0.15em',
    color: active ? COLOURS.accent : COLOURS.textMuted,
    textTransform: 'uppercase' as const,
    borderBottom: `1px solid ${COLOURS.border}`,
    cursor: 'pointer',
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
    position: 'sticky' as const,
    top: 0,
    background: COLOURS.bg,
    zIndex: 1,
  }),
  thRight: (active: boolean) => ({
    padding: '8px 10px',
    textAlign: 'right' as const,
    fontSize: '9px',
    letterSpacing: '0.15em',
    color: active ? COLOURS.accent : COLOURS.textMuted,
    textTransform: 'uppercase' as const,
    borderBottom: `1px solid ${COLOURS.border}`,
    cursor: 'pointer',
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
    position: 'sticky' as const,
    top: 0,
    background: COLOURS.bg,
    zIndex: 1,
  }),
  td: {
    padding: '7px 10px',
    borderBottom: `1px solid rgba(30, 45, 61, 0.4)`,
    color: COLOURS.text,
  },
  tdRight: {
    padding: '7px 10px',
    borderBottom: `1px solid rgba(30, 45, 61, 0.4)`,
    color: COLOURS.text,
    textAlign: 'right' as const,
  },
  tdName: {
    padding: '7px 10px',
    borderBottom: `1px solid rgba(30, 45, 61, 0.4)`,
    color: COLOURS.textBright,
    fontWeight: 500,
  },
  row: (selected: boolean) => ({
    cursor: 'pointer',
    background: selected ? COLOURS.rowSelected : 'transparent',
    transition: 'background 0.1s',
  }),
  // Section label (shared pattern)
  sectionLabel: {
    fontSize: '9px',
    letterSpacing: '0.2em',
    color: COLOURS.accent,
    textTransform: 'uppercase' as const,
    marginBottom: '8px',
    opacity: 0.85,
  },
  // Price chart placeholder
  chartContainer: {
    background: COLOURS.card,
    border: `1px solid ${COLOURS.border}`,
    borderRadius: '2px',
    padding: '20px',
    minHeight: '140px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  chartPlaceholder: {
    color: COLOURS.textMuted,
    fontSize: '11px',
    letterSpacing: '0.06em',
    textAlign: 'center' as const,
  },
  chartMiniBar: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '2px',
    height: '60px',
    padding: '0 10px',
  },
  // Trade actions
  tradeCard: {
    background: COLOURS.card,
    border: `1px solid ${COLOURS.border}`,
    borderRadius: '2px',
    padding: '14px',
  },
  tradeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '10px',
  },
  tradeInput: {
    background: 'rgba(0, 0, 0, 0.3)',
    border: `1px solid ${COLOURS.border}`,
    color: COLOURS.text,
    padding: '6px 8px',
    fontSize: '12px',
    width: '80px',
    fontFamily: 'inherit',
    textAlign: 'right' as const,
  },
  tradeBtn: (variant: 'buy' | 'sell') => ({
    background: variant === 'buy'
      ? 'rgba(0, 212, 255, 0.12)'
      : 'rgba(255, 68, 68, 0.12)',
    border: `1px solid ${variant === 'buy' ? COLOURS.accent : COLOURS.red}`,
    color: variant === 'buy' ? COLOURS.accent : COLOURS.red,
    padding: '6px 14px',
    fontSize: '11px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    flex: 1,
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  }),
  tradeBtnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  tradeInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '10px',
    color: COLOURS.textMuted,
    marginTop: '8px',
  },
  // Sanctions
  sanctionCard: {
    background: 'rgba(255, 68, 68, 0.06)',
    border: `1px solid rgba(255, 68, 68, 0.2)`,
    borderRadius: '2px',
    padding: '10px 14px',
    fontSize: '11px',
    color: COLOURS.text,
  },
  sanctionEmpty: {
    color: COLOURS.textMuted,
    fontSize: '10px',
    fontStyle: 'italic' as const,
  },
  divider: {
    border: 'none',
    borderTop: `1px solid ${COLOURS.border}`,
    margin: '10px 0 8px',
    flexShrink: 0,
  },
  // Category badge
  categoryBadge: (category: CommodityCategory) => ({
    display: 'inline-block',
    padding: '1px 6px',
    fontSize: '9px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    border: `1px solid ${CATEGORY_COLOURS[category]}40`,
    color: CATEGORY_COLOURS[category],
    background: `${CATEGORY_COLOURS[category]}10`,
    borderRadius: '2px',
  }),
  // Market access badge
  accessBadge: (level: MarketAccessLevel) => ({
    display: 'inline-block',
    padding: '2px 8px',
    fontSize: '9px',
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    border: `1px solid ${level === 'galactic' ? COLOURS.accent : COLOURS.border}`,
    color: level === 'galactic' ? COLOURS.accent : COLOURS.textMuted,
    background: level === 'galactic' ? 'rgba(0, 212, 255, 0.08)' : 'transparent',
  }),
  // Inflation colour
  inflationColour: (rate: number): string => {
    if (rate < 1.0) return COLOURS.green;
    if (rate <= 1.1) return COLOURS.yellow;
    return COLOURS.red;
  },
} as const;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MarketScreen({
  credits,
  inflationRate,
  activeTradeRoutes,
  marketAccess,
  commodities,
  stockpiles,
  sanctions,
  onBuy,
  onSell,
  onClose,
}: MarketScreenProps): React.ReactElement {
  // ── Local state ──────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [buyQty, setBuyQty] = useState<number>(1);
  const [sellQty, setSellQty] = useState<number>(1);

  // ── Selected commodity ──────────────────────────────────────────────
  const selectedCommodity = useMemo(
    () => commodities.find(c => c.id === selectedId) ?? null,
    [commodities, selectedId],
  );

  // ── Sorting handler ──────────────────────────────────────────────────
  const handleSort = useCallback((key: SortKey) => {
    setSortKey(prev => {
      if (prev === key) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return key;
      }
      setSortDir(key === 'name' ? 'asc' : 'desc');
      return key;
    });
  }, []);

  // ── Filtered + sorted rows ──────────────────────────────────────────
  const filteredRows = useMemo(() => {
    let rows = [...commodities];
    if (categoryFilter !== 'all') {
      rows = rows.filter(c => c.category === categoryFilter);
    }
    rows.sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case 'name':         diff = a.name.localeCompare(b.name); break;
        case 'category':     diff = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category]; break;
        case 'currentPrice': diff = a.currentPrice - b.currentPrice; break;
        case 'basePrice':    diff = a.basePrice - b.basePrice; break;
        case 'change':       diff = pctChange(a.currentPrice, a.basePrice) - pctChange(b.currentPrice, b.basePrice); break;
        case 'supply':       diff = a.supply - b.supply; break;
        case 'demand':       diff = a.demand - b.demand; break;
        case 'trend': {
          const trendOrder: Record<MarketTrend, number> = { falling: 0, stable: 1, rising: 2 };
          diff = trendOrder[a.trend] - trendOrder[b.trend];
          break;
        }
      }
      return sortDir === 'desc' ? -diff : diff;
    });
    return rows;
  }, [commodities, categoryFilter, sortKey, sortDir]);

  // ── Trade handlers ──────────────────────────────────────────────────
  const handleBuy = useCallback(() => {
    if (!selectedId || buyQty <= 0) return;
    onBuy?.(selectedId, buyQty);
  }, [selectedId, buyQty, onBuy]);

  const handleSell = useCallback(() => {
    if (!selectedId || sellQty <= 0) return;
    onSell?.(selectedId, sellQty);
  }, [selectedId, sellQty, onSell]);

  // ── Column definitions ──────────────────────────────────────────────
  const columns: Array<{ key: SortKey; label: string; align: 'left' | 'right' }> = [
    { key: 'name',         label: 'Commodity',  align: 'left'  },
    { key: 'category',     label: 'Category',   align: 'left'  },
    { key: 'currentPrice', label: 'Price',      align: 'right' },
    { key: 'basePrice',    label: 'Base',       align: 'right' },
    { key: 'change',       label: 'Change',     align: 'right' },
    { key: 'supply',       label: 'Supply',     align: 'right' },
    { key: 'demand',       label: 'Demand',     align: 'right' },
    { key: 'trend',        label: 'Trend',      align: 'right' },
  ];

  // ── Price history mini-chart ────────────────────────────────────────
  function renderMiniChart(history: number[]): React.ReactElement {
    if (history.length === 0) {
      return (
        <div style={{ ...styles.chartPlaceholder, padding: '16px 0' }}>
          No price history available yet.
        </div>
      );
    }
    const max = Math.max(...history);
    const min = Math.min(...history);
    const range = max - min || 1;

    return (
      <div style={styles.chartMiniBar}>
        {history.map((price, idx) => {
          const height = Math.max(4, ((price - min) / range) * 56 + 4);
          const isLast = idx === history.length - 1;
          return (
            <div
              key={idx}
              style={{
                width: `${Math.max(4, Math.min(12, 300 / history.length))}px`,
                height: `${height}px`,
                background: isLast ? COLOURS.accent : 'rgba(0, 212, 255, 0.3)',
                borderRadius: '1px 1px 0 0',
                transition: 'height 0.2s',
              }}
              title={`${fmt(price, 1)} credits`}
            />
          );
        })}
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.screen} onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div style={styles.header}>
          <div style={styles.headerInfo}>
            <h2 style={styles.headerTitle}>Commodity Market</h2>
            <div style={styles.headerSubtitle}>
              {commodities.length} commodities listed &mdash; {filteredRows.length} shown
            </div>
          </div>
          <button
            type="button"
            style={styles.closeBtn}
            onClick={onClose}
            aria-label="Close market screen"
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = COLOURS.accent;
              e.currentTarget.style.color = COLOURS.accent;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = COLOURS.border;
              e.currentTarget.style.color = COLOURS.textMuted;
            }}
          >
            &times;
          </button>
        </div>

        {/* ── Market Summary Bar ── */}
        <div style={styles.summaryBar}>
          {/* Credits */}
          <div style={styles.summaryItem}>
            <span style={styles.summaryLabel}>Credits</span>
            <span style={{ ...styles.summaryValue, color: COLOURS.yellow }}>
              {fmt(credits)} C
            </span>
          </div>

          {/* Inflation */}
          <div style={styles.summaryItem}>
            <span style={styles.summaryLabel}>Inflation</span>
            <span style={{
              ...styles.summaryValue,
              color: styles.inflationColour(inflationRate),
            }}>
              {(inflationRate * 100).toFixed(1)}%
            </span>
          </div>

          {/* Trade Routes */}
          <div style={styles.summaryItem}>
            <span style={styles.summaryLabel}>Trade Routes</span>
            <span style={styles.summaryValue}>
              {activeTradeRoutes}
            </span>
          </div>

          {/* Market Access */}
          <div style={styles.summaryItem}>
            <span style={styles.summaryLabel}>Access</span>
            <span style={styles.accessBadge(marketAccess)}>
              {marketAccess === 'galactic' ? 'Galactic Council Member' : 'Local'}
            </span>
          </div>

          {/* Sanctions indicator */}
          {sanctions.length > 0 && (
            <div style={{ ...styles.summaryItem, marginLeft: 'auto' }}>
              <span style={{
                fontSize: '10px',
                letterSpacing: '0.1em',
                color: COLOURS.red,
                textTransform: 'uppercase',
                border: `1px solid ${COLOURS.red}40`,
                padding: '2px 8px',
              }}>
                {sanctions.length} Sanction{sanctions.length !== 1 ? 's' : ''} Active
              </span>
            </div>
          )}
        </div>

        {/* ── Body: two columns ── */}
        <div style={styles.body}>

          {/* ── Left: Filter bar + Commodity Table ── */}
          <div style={styles.leftCol}>
            {/* Filter bar */}
            <div style={styles.filterBar}>
              <span style={{
                fontSize: '9px',
                color: COLOURS.textMuted,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                marginRight: '4px',
              }}>
                Filter
              </span>
              {(['all', 'common', 'rare', 'ultra_rare'] as CategoryFilter[]).map(cat => (
                <button
                  key={cat}
                  type="button"
                  style={styles.filterBtn(categoryFilter === cat)}
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat === 'all' ? 'All' : CATEGORY_LABELS[cat as CommodityCategory]}
                </button>
              ))}
              <span style={{
                marginLeft: 'auto',
                fontSize: '10px',
                color: COLOURS.textMuted,
              }}>
                {filteredRows.length} result{filteredRows.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Table */}
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {columns.map(col => (
                      <th
                        key={col.key}
                        style={col.align === 'right'
                          ? styles.thRight(sortKey === col.key)
                          : styles.th(sortKey === col.key)
                        }
                        onClick={() => handleSort(col.key)}
                        title={`Sort by ${col.label}`}
                      >
                        {col.label}
                        {sortKey === col.key && (
                          <span style={{ marginLeft: '4px' }}>
                            {sortDir === 'desc' ? '\u2193' : '\u2191'}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columns.length}
                        style={{
                          ...styles.td,
                          textAlign: 'center',
                          color: COLOURS.textMuted,
                          padding: '24px 10px',
                        }}
                      >
                        No commodities match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map(commodity => {
                      const change = pctChange(commodity.currentPrice, commodity.basePrice);
                      const isSelected = commodity.id === selectedId;

                      return (
                        <tr
                          key={commodity.id}
                          style={styles.row(isSelected)}
                          onClick={() => {
                            setSelectedId(commodity.id === selectedId ? null : commodity.id);
                            setBuyQty(1);
                            setSellQty(1);
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = COLOURS.rowHover;
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = 'transparent';
                            }
                          }}
                        >
                          {/* Name */}
                          <td style={styles.tdName}>{commodity.name}</td>

                          {/* Category */}
                          <td style={styles.td}>
                            <span style={styles.categoryBadge(commodity.category)}>
                              {CATEGORY_LABELS[commodity.category]}
                            </span>
                          </td>

                          {/* Current Price */}
                          <td style={{ ...styles.tdRight, color: COLOURS.yellow }}>
                            {fmt(commodity.currentPrice, 1)} C
                          </td>

                          {/* Base Price */}
                          <td style={{ ...styles.tdRight, color: COLOURS.textMuted }}>
                            {fmt(commodity.basePrice, 1)}
                          </td>

                          {/* Change % */}
                          <td style={{
                            ...styles.tdRight,
                            color: change > 0 ? COLOURS.green : change < 0 ? COLOURS.red : COLOURS.textMuted,
                          }}>
                            {change > 0 ? '+' : ''}{change.toFixed(1)}%
                            {change > 0 ? ' \u25B2' : change < 0 ? ' \u25BC' : ''}
                          </td>

                          {/* Supply */}
                          <td style={styles.tdRight}>{fmt(commodity.supply)}</td>

                          {/* Demand */}
                          <td style={styles.tdRight}>{fmt(commodity.demand)}</td>

                          {/* Trend */}
                          <td style={{
                            ...styles.tdRight,
                            color: TREND_COLOURS[commodity.trend],
                          }}>
                            {TREND_ICONS[commodity.trend]}
                            <span style={{ marginLeft: '4px', fontSize: '10px' }}>
                              {commodity.trend.charAt(0).toUpperCase() + commodity.trend.slice(1)}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Right Column: Chart + Trade + Sanctions ── */}
          <div style={styles.rightCol}>

            {/* ── Price Chart ── */}
            <div>
              <div style={styles.sectionLabel}>Price History</div>
              <div style={styles.chartContainer}>
                {selectedCommodity ? (
                  <>
                    <div style={{
                      fontSize: '12px',
                      color: COLOURS.textBright,
                      marginBottom: '4px',
                    }}>
                      {selectedCommodity.name}
                    </div>
                    <div style={{
                      fontSize: '10px',
                      color: COLOURS.textMuted,
                      marginBottom: '8px',
                    }}>
                      Last {selectedCommodity.priceHistory.length} turn{selectedCommodity.priceHistory.length !== 1 ? 's' : ''}
                    </div>
                    {renderMiniChart(selectedCommodity.priceHistory)}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      width: '100%',
                      marginTop: '8px',
                      fontSize: '10px',
                      color: COLOURS.textMuted,
                    }}>
                      <span>
                        Low: {fmt(Math.min(...(selectedCommodity.priceHistory.length > 0 ? selectedCommodity.priceHistory : [0])), 1)} C
                      </span>
                      <span>
                        High: {fmt(Math.max(...(selectedCommodity.priceHistory.length > 0 ? selectedCommodity.priceHistory : [0])), 1)} C
                      </span>
                    </div>
                  </>
                ) : (
                  <div style={styles.chartPlaceholder}>
                    Select a commodity to view price history
                  </div>
                )}
              </div>
            </div>

            <hr style={styles.divider} />

            {/* ── Trade Actions ── */}
            <div>
              <div style={styles.sectionLabel}>Trade Actions</div>
              {selectedCommodity ? (
                <div style={styles.tradeCard}>
                  {/* Commodity info */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px',
                  }}>
                    <span style={{ color: COLOURS.textBright, fontSize: '13px' }}>
                      {selectedCommodity.name}
                    </span>
                    <span style={{
                      color: COLOURS.yellow,
                      fontSize: '14px',
                      fontWeight: 600,
                    }}>
                      {fmt(selectedCommodity.currentPrice, 1)} C
                    </span>
                  </div>

                  {/* Stockpile info */}
                  <div style={styles.tradeInfo}>
                    <span>Your stockpile: {fmt(stockpiles[selectedCommodity.id] ?? 0)} units</span>
                    <span style={styles.accessBadge(marketAccess)}>
                      Market access: {marketAccess === 'galactic' ? 'Galactic' : 'Local'}
                    </span>
                  </div>

                  {/* Buy row */}
                  <div style={styles.tradeRow}>
                    <label style={{
                      fontSize: '10px',
                      color: COLOURS.textMuted,
                      width: '30px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                    }}>
                      Buy
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={buyQty}
                      onChange={(e) => setBuyQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      style={styles.tradeInput}
                      aria-label="Buy quantity"
                    />
                    <button
                      type="button"
                      style={{
                        ...styles.tradeBtn('buy'),
                        ...(buyQty <= 0 || !onBuy ? styles.tradeBtnDisabled : {}),
                      }}
                      onClick={handleBuy}
                      disabled={buyQty <= 0 || !onBuy}
                      title={`Buy ${buyQty} units for ${fmt(buyQty * selectedCommodity.currentPrice, 1)} C`}
                    >
                      Buy {fmt(buyQty * selectedCommodity.currentPrice, 1)} C
                    </button>
                  </div>

                  {/* Sell row */}
                  <div style={styles.tradeRow}>
                    <label style={{
                      fontSize: '10px',
                      color: COLOURS.textMuted,
                      width: '30px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                    }}>
                      Sell
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={stockpiles[selectedCommodity.id] ?? 0}
                      value={sellQty}
                      onChange={(e) => setSellQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      style={styles.tradeInput}
                      aria-label="Sell quantity"
                    />
                    <button
                      type="button"
                      style={{
                        ...styles.tradeBtn('sell'),
                        ...(sellQty <= 0 || sellQty > (stockpiles[selectedCommodity.id] ?? 0) || !onSell
                          ? styles.tradeBtnDisabled
                          : {}),
                      }}
                      onClick={handleSell}
                      disabled={sellQty <= 0 || sellQty > (stockpiles[selectedCommodity.id] ?? 0) || !onSell}
                      title={`Sell ${sellQty} units for ${fmt(sellQty * selectedCommodity.currentPrice, 1)} C`}
                    >
                      Sell {fmt(sellQty * selectedCommodity.currentPrice, 1)} C
                    </button>
                  </div>

                  {/* Cost/revenue summary */}
                  <div style={{
                    ...styles.tradeInfo,
                    marginTop: '10px',
                    paddingTop: '8px',
                    borderTop: `1px solid ${COLOURS.border}`,
                  }}>
                    <span>
                      Available credits: <span style={{ color: COLOURS.yellow }}>{fmt(credits)} C</span>
                    </span>
                  </div>
                </div>
              ) : (
                <div style={styles.tradeCard}>
                  <div style={styles.chartPlaceholder}>
                    Select a commodity to trade
                  </div>
                </div>
              )}
            </div>

            <hr style={styles.divider} />

            {/* ── Sanctions Panel ── */}
            <div>
              <div style={styles.sectionLabel}>Sanctions</div>
              {sanctions.length === 0 ? (
                <div style={styles.sanctionEmpty}>
                  No active sanctions against your empire.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {sanctions.map((sanction, idx) => (
                    <div key={idx} style={styles.sanctionCard}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <span style={{ color: COLOURS.red, fontWeight: 500 }}>
                          Imposed by {sanction.imposedBy}
                        </span>
                      </div>
                      {sanction.blockedCommodities.length > 0 && (
                        <div style={{
                          marginTop: '4px',
                          fontSize: '10px',
                          color: COLOURS.textMuted,
                        }}>
                          Blocked: {sanction.blockedCommodities.length} commodit{sanction.blockedCommodities.length !== 1 ? 'ies' : 'y'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
