import React from 'react';
import type {
  PlanetDemographics,
  VocationDistribution,
  WealthDistribution,
  PoliticalFaction,
  FactionAction,
} from '@nova-imperia/shared';
import { getSettlementTier, SETTLEMENT_TIER_THRESHOLDS } from '@nova-imperia/shared';
import { PlanetHealthDot } from './PlanetHealthDot';

// ── Constants ───────────────────────────────────────────────────────────────

/** Population threshold: below this, show simplified view. */
const FULL_DASHBOARD_THRESHOLD = 1_000_000;

// ── Props ───────────────────────────────────────────────────────────────────

export interface DemographicsPanelProps {
  demographics: PlanetDemographics;
  /** Population growth rate as a fraction per tick (e.g. 0.002 = 0.2% per day). */
  growthRate?: number;
  /** Historical population data points for sparkline (last 20 values). */
  populationHistory?: number[];
  /** Political factions active on this planet / in the empire. */
  factions?: PoliticalFaction[];
  /** Active alert types for this planet. */
  alerts?: AlertType[];
  /** Callback when the player adjusts workforce allocation targets. */
  onAllocationChange?: (vocation: keyof VocationDistribution, delta: number) => void;
}

// ── Alert types ─────────────────────────────────────────────────────────────

export type AlertType =
  | 'UNEMPLOYED'
  | 'HOUSING'
  | 'UNREST'
  | 'DISEASE'
  | 'STARVATION'
  | 'CRIME';

const ALERT_COLOURS: Record<AlertType, string> = {
  UNEMPLOYED: '#f59e0b',
  HOUSING: '#f97316',
  UNREST: '#ef4444',
  DISEASE: '#a855f7',
  STARVATION: '#ef4444',
  CRIME: '#f59e0b',
};

const ALERT_LABELS: Record<AlertType, string> = {
  UNEMPLOYED: 'Unemployed',
  HOUSING: 'Housing',
  UNREST: 'Unrest',
  DISEASE: 'Disease',
  STARVATION: 'Starvation',
  CRIME: 'Crime',
};

// ── Colour palette ──────────────────────────────────────────────────────────

const C = {
  bg: '#0a0e17',
  card: '#111827',
  border: '#1e2d3d',
  accent: '#00d4ff',

  // Health dots
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',

  // Age
  young: '#3b82f6',
  workingAge: '#10b981',
  elderly: '#f59e0b',

  // Vocations
  scientists: '#22d3ee',
  workers: '#ca8a04',
  military: '#ef4444',
  merchants: '#eab308',
  administrators: '#8b5cf6',
  educators: '#14b8a6',
  medical: '#34d399',
  general: '#6b7280',

  // Wealth
  elite: '#fbbf24',
  middle: '#10b981',
  working: '#3b82f6',
  destitute: '#ef4444',

  // Loyalty
  loyal: '#10b981',
  content: '#6ee7b7',
  disgruntled: '#f59e0b',
  rebellious: '#ef4444',

  // Faith
  fanatics: '#991b1b',
  observant: '#ca8a04',
  casual: '#eab308',
  indifferent: '#6b7280',
  secular: '#3b82f6',

  // Faction satisfaction
  factionHappy: '#10b981',
  factionNeutral: '#f59e0b',
  factionAngry: '#ef4444',

  // Faction action
  actionLobbying: '#10b981',
  actionFunding: '#22d3ee',
  actionStrikes: '#f59e0b',
  actionProtests: '#f97316',
  actionCoup: '#ef4444',

  // Typography
  text: '#ccdde8',
  label: '#8899aa',
  heading: '#aabbcc',
  muted: '#556677',
  warning: '#f59e0b',
  danger: '#ef4444',

  // Growth
  growthUp: '#10b981',
  growthDown: '#ef4444',
  growthStable: '#6b7280',
} as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatPop(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function pct(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}

function pctNum(value: number, total: number): number {
  if (total === 0) return 0;
  return (value / total) * 100;
}

function fractionPct(frac: number): string {
  return `${(frac * 100).toFixed(1)}%`;
}

function getTierLabel(population: number): string {
  const tier = getSettlementTier(population);
  return SETTLEMENT_TIER_THRESHOLDS[tier].name;
}

function getGrowthColour(rate?: number): string {
  if (rate === undefined || rate === 0) return C.growthStable;
  return rate > 0 ? C.growthUp : C.growthDown;
}

function getGrowthArrow(rate?: number): string {
  if (rate === undefined || rate === 0) return '\u2192'; // →
  return rate > 0 ? '\u2191' : '\u2193'; // ↑ or ↓
}

function getHappiness(demographics: PlanetDemographics): number {
  // Derive happiness from loyalty distribution as a weighted average
  const { loyal, content, disgruntled, rebellious } = demographics.loyalty;
  const total = loyal + content + disgruntled + rebellious;
  if (total === 0) return 50;
  return ((loyal * 100 + content * 70 + disgruntled * 30 + rebellious * 5) / total);
}

function getFactionActionColour(action: FactionAction): string {
  switch (action) {
    case 'lobbying': return C.actionLobbying;
    case 'funding': return C.actionFunding;
    case 'strikes': return C.actionStrikes;
    case 'protests': return C.actionProtests;
    case 'coup': return C.actionCoup;
    default: return C.muted;
  }
}

function getFactionSatisfactionColour(satisfaction: number): string {
  if (satisfaction > 30) return C.factionHappy;
  if (satisfaction > -30) return C.factionNeutral;
  return C.factionAngry;
}

/** Approximate Gini coefficient from the four-band wealth model. */
function calculateGini(wealth: WealthDistribution): number {
  const bands = [
    { share: wealth.destitute, income: 0.05 },
    { share: wealth.workingClass, income: 0.3 },
    { share: wealth.middleClass, income: 0.7 },
    { share: wealth.wealthyElite, income: 2.0 },
  ];
  const totalShare = bands.reduce((s, b) => s + b.share, 0);
  if (totalShare === 0) return 0;
  const meanIncome = bands.reduce((s, b) => s + b.share * b.income, 0) / totalShare;
  if (meanIncome === 0) return 0;
  let sumAbsDiff = 0;
  for (const a of bands) {
    for (const b of bands) {
      sumAbsDiff += a.share * b.share * Math.abs(a.income - b.income);
    }
  }
  return Math.max(0, Math.min(1, sumAbsDiff / (2 * totalShare * totalShare * meanIncome)));
}

// ── Inline styles ───────────────────────────────────────────────────────────

const S_PANEL: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  fontSize: '12px',
  color: C.text,
  maxHeight: '100%',
  overflowY: 'auto',
  padding: '6px',
};

const S_CARD: React.CSSProperties = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: '4px',
  padding: '8px',
};

const S_SECTION_TITLE: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
  color: C.heading,
  marginBottom: '6px',
};

const S_ROW: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '2px',
};

const S_FLEX_CENTER: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const S_STACKED_BAR: React.CSSProperties = {
  display: 'flex',
  height: '10px',
  borderRadius: '3px',
  overflow: 'hidden',
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
};

const S_STACKED_BAR_THIN: React.CSSProperties = {
  ...S_STACKED_BAR,
  height: '8px',
};

const S_BADGE: (colour: string) => React.CSSProperties = (colour) => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '1px 6px',
  borderRadius: '3px',
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.3px',
  background: `${colour}22`,
  color: colour,
  border: `1px solid ${colour}44`,
});

const S_BTN: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '18px',
  height: '18px',
  borderRadius: '3px',
  border: `1px solid ${C.border}`,
  background: 'rgba(255,255,255,0.04)',
  color: C.accent,
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
  lineHeight: 1,
};

// ── Sub-components ──────────────────────────────────────────────────────────

/** Tiny SVG sparkline from an array of numeric values. */
function Sparkline({ data, width = 80, height = 20, colour = C.accent }: {
  data: number[];
  width?: number;
  height?: number;
  colour?: string;
}): React.ReactElement | null {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={colour}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Horizontal stacked bar with labelled segments. */
function StackedBar({ segments, thin = false }: {
  segments: Array<{ label: string; value: number; colour: string }>;
  thin?: boolean;
}): React.ReactElement {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return <div style={{ ...( thin ? S_STACKED_BAR_THIN : S_STACKED_BAR), opacity: 0.3 }} />;
  }

  return (
    <div style={thin ? S_STACKED_BAR_THIN : S_STACKED_BAR}>
      {segments.map((seg) => {
        const w = (seg.value / total) * 100;
        if (w < 0.3) return null;
        return (
          <div
            key={seg.label}
            title={`${seg.label}: ${pct(seg.value, total)}`}
            style={{
              width: `${w}%`,
              background: seg.colour,
              transition: 'width 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '8px',
              color: '#0a0e17',
              fontWeight: 700,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            {w > 12 ? `${w.toFixed(0)}%` : ''}
          </div>
        );
      })}
    </div>
  );
}

/** Legend row beneath a stacked bar. */
function BarLegend({ segments }: {
  segments: Array<{ label: string; value: number; colour: string }>;
}): React.ReactElement {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '3px' }}>
      {segments.map((seg) => {
        const w = total > 0 ? (seg.value / total) * 100 : 0;
        if (w < 0.3) return null;
        return (
          <span key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9px', color: C.label }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '2px', background: seg.colour, flexShrink: 0 }} />
            {seg.label} {pct(seg.value, total)}
          </span>
        );
      })}
    </div>
  );
}

/** Simple horizontal level bar (0-100, colour-coded). */
function LevelBar({ value, label }: {
  value: number;
  label: string;
}): React.ReactElement {
  const clamped = Math.max(0, Math.min(100, value));
  const colour = clamped > 70 ? C.green : clamped >= 40 ? C.amber : C.red;

  return (
    <div style={{ marginBottom: '4px' }}>
      <div style={S_ROW}>
        <span style={{ color: C.label, fontSize: '11px' }}>{label}</span>
        <span style={{ color: colour, fontWeight: 700, fontSize: '11px' }}>{clamped.toFixed(0)}</span>
      </div>
      <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${clamped}%`, height: '100%', background: colour, borderRadius: '3px', transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

/** Alert badge row — only renders badges that are present. */
function AlertBadges({ alerts }: { alerts?: AlertType[] }): React.ReactElement | null {
  if (!alerts || alerts.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
      {alerts.map((a) => (
        <span key={a} style={S_BADGE(ALERT_COLOURS[a])}>
          {ALERT_LABELS[a]}
        </span>
      ))}
    </div>
  );
}

// ── Vocation config ─────────────────────────────────────────────────────────

const VOCATION_CONFIG: Array<{ key: keyof VocationDistribution; label: string; colour: string }> = [
  { key: 'scientists', label: 'Scientists', colour: C.scientists },
  { key: 'workers', label: 'Workers', colour: C.workers },
  { key: 'military', label: 'Military', colour: C.military },
  { key: 'merchants', label: 'Merchants', colour: C.merchants },
  { key: 'administrators', label: 'Administrators', colour: C.administrators },
  { key: 'educators', label: 'Educators', colour: C.educators },
  { key: 'medical', label: 'Medical', colour: C.medical },
  { key: 'general', label: 'General', colour: C.general },
];

// ═══════════════════════════════════════════════════════════════════════════
// MODE 1: Simplified View (population < 1,000,000)
// ═══════════════════════════════════════════════════════════════════════════

function SimplifiedView({
  demographics,
  growthRate,
  alerts,
}: {
  demographics: PlanetDemographics;
  growthRate?: number;
  alerts?: AlertType[];
}): React.ReactElement {
  const { totalPopulation, vocations, healthLevel } = demographics;
  const tierLabel = getTierLabel(totalPopulation);
  const happiness = getHappiness(demographics);
  const growthColour = getGrowthColour(growthRate);
  const arrow = getGrowthArrow(growthRate);

  return (
    <div style={S_PANEL} className="demographics-panel demographics-panel--simplified">
      <div style={S_CARD}>
        {/* Row 1: Tier + population + health dot + trend */}
        <div style={{ ...S_FLEX_CENTER, justifyContent: 'space-between' }}>
          <div style={S_FLEX_CENTER}>
            <PlanetHealthDot value={happiness} size={14} />
            <span style={{ fontWeight: 700, fontSize: '13px' }}>{formatPop(totalPopulation)}</span>
            <span style={{ color: growthColour, fontWeight: 700, fontSize: '13px' }}>{arrow}</span>
          </div>
          <span style={{ color: C.heading, fontSize: '11px', fontWeight: 600 }}>{tierLabel}</span>
        </div>

        {/* Row 2: Workforce summary (single line) */}
        <div style={{ marginTop: '6px', fontSize: '11px', color: C.label }}>
          <span>Workers: <span style={{ color: C.text }}>{formatPop(vocations.workers)}</span></span>
          <span style={{ margin: '0 6px', color: C.muted }}>|</span>
          <span>Military: <span style={{ color: C.text }}>{formatPop(vocations.military)}</span></span>
          <span style={{ margin: '0 6px', color: C.muted }}>|</span>
          <span>Scientists: <span style={{ color: C.text }}>{formatPop(vocations.scientists)}</span></span>
        </div>

        {/* Row 3: Alert badges */}
        {alerts && alerts.length > 0 && (
          <div style={{ marginTop: '6px' }}>
            <AlertBadges alerts={alerts} />
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MODE 2: Full Demographics Dashboard (population >= 1,000,000)
// ═══════════════════════════════════════════════════════════════════════════

function FullDashboard({
  demographics,
  growthRate,
  populationHistory,
  factions,
  alerts,
  onAllocationChange,
}: {
  demographics: PlanetDemographics;
  growthRate?: number;
  populationHistory?: number[];
  factions?: PoliticalFaction[];
  alerts?: AlertType[];
  onAllocationChange?: (vocation: keyof VocationDistribution, delta: number) => void;
}): React.ReactElement {
  const {
    totalPopulation,
    age,
    vocations,
    faith,
    loyalty,
    healthLevel,
    wealth,
    employment,
    crime,
    secondarySpecies,
    primarySpeciesId,
  } = demographics;

  const happiness = getHappiness(demographics);
  const tierLabel = getTierLabel(totalPopulation);
  const totalAge = age.young + age.workingAge + age.elderly;
  const totalLoyalty = loyalty.loyal + loyalty.content + loyalty.disgruntled + loyalty.rebellious;
  const rebelliousPct = totalLoyalty > 0 ? (loyalty.rebellious / totalLoyalty) * 100 : 0;

  const growthColour = getGrowthColour(growthRate);
  const growthText = growthRate === undefined
    ? '--'
    : `${growthRate >= 0 ? '+' : ''}${(growthRate * 100).toFixed(2)}%/day`;

  return (
    <div style={S_PANEL} className="demographics-panel demographics-panel--full">
      {/* ── Section A: Overview Bar ──────────────────────────────────────── */}
      <div style={S_CARD}>
        <div style={{ ...S_FLEX_CENTER, justifyContent: 'space-between' }}>
          <div style={S_FLEX_CENTER}>
            <PlanetHealthDot value={happiness} size={18} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={S_FLEX_CENTER}>
                <span style={{ fontWeight: 700, fontSize: '15px' }}>{formatPop(totalPopulation)}</span>
                <span style={{ color: C.heading, fontSize: '11px' }}>{tierLabel}</span>
              </div>
              <span style={{ color: growthColour, fontSize: '11px', fontWeight: 600 }}>{growthText}</span>
            </div>
          </div>
          {populationHistory && populationHistory.length >= 2 && (
            <Sparkline data={populationHistory} width={80} height={22} colour={growthColour} />
          )}
        </div>
      </div>

      {/* ── Section B: Workforce Allocation (MOO2 style) ────────────────── */}
      <div style={S_CARD}>
        <div style={S_SECTION_TITLE}>Workforce Allocation</div>

        {/* Employment summary */}
        {employment && (
          <div style={{ marginBottom: '6px' }}>
            <div style={S_ROW}>
              <span style={{ color: C.label, fontSize: '10px' }}>Employment</span>
              <span style={{
                color: employment.unemploymentRate > 0.15 ? C.danger : employment.unemploymentRate > 0.05 ? C.warning : C.green,
                fontWeight: 700,
                fontSize: '11px',
              }}>
                {fractionPct(1 - employment.unemploymentRate)}
              </span>
            </div>
            {employment.labourShortage && (
              <div style={{ fontSize: '9px', color: C.warning, marginTop: '1px' }}>
                Labour shortage — not enough workers
              </div>
            )}
          </div>
        )}

        {/* Per-vocation rows */}
        {VOCATION_CONFIG.map((v) => {
          const count = vocations[v.key];
          const barWidth = age.workingAge > 0 ? Math.min(pctNum(count, age.workingAge), 100) : 0;
          const gap = employment?.skillGaps[v.key];
          const hasGap = gap !== undefined && gap > 0;

          return (
            <div key={v.key} style={{ marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '1px' }}>
                {/* Icon placeholder */}
                <span style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '3px',
                  background: `${v.colour}33`,
                  border: `1px solid ${v.colour}66`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '8px',
                  color: v.colour,
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {v.label[0]}
                </span>

                <span style={{ color: C.label, fontSize: '10px', flex: 1 }}>{v.label}</span>

                <span style={{ fontSize: '10px', fontWeight: 600, color: C.text, minWidth: '40px', textAlign: 'right' }}>
                  {formatPop(count)}
                </span>

                {/* +/- allocation buttons */}
                {onAllocationChange && (
                  <div style={{ display: 'flex', gap: '2px', marginLeft: '4px' }}>
                    <button
                      style={S_BTN}
                      onClick={() => onAllocationChange(v.key, -1)}
                      title={`Reduce ${v.label} target`}
                    >
                      -
                    </button>
                    <button
                      style={S_BTN}
                      onClick={() => onAllocationChange(v.key, 1)}
                      title={`Increase ${v.label} target`}
                    >
                      +
                    </button>
                  </div>
                )}
              </div>

              {/* Progress bar: filled / total working-age */}
              <div style={{ ...S_STACKED_BAR_THIN, marginBottom: '1px' }}>
                <div style={{
                  width: `${barWidth}%`,
                  height: '100%',
                  background: v.colour,
                  borderRadius: '3px',
                  transition: 'width 0.3s',
                }} />
              </div>

              {/* Skill gap warning */}
              {hasGap && (
                <div style={{ fontSize: '9px', color: C.warning }}>
                  Need {formatPop(gap)} more {v.label.toLowerCase()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Section C: Population Composition ───────────────────────────── */}
      <div style={S_CARD}>
        <div style={S_SECTION_TITLE}>Population Composition</div>

        {/* Species stacked bar (multi-species) */}
        {secondarySpecies && secondarySpecies.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '10px', color: C.label, marginBottom: '3px' }}>Species</div>
            {(() => {
              const primaryPop = totalPopulation - secondarySpecies.reduce((s, sp) => s + sp.population, 0);
              const speciesSegments = [
                { label: primarySpeciesId, value: primaryPop, colour: C.accent },
                ...secondarySpecies.map((sp, i) => ({
                  label: sp.speciesId,
                  value: sp.population,
                  colour: ['#a78bfa', '#fb923c', '#f472b6', '#38bdf8'][i % 4],
                })),
              ];
              return (
                <>
                  <StackedBar segments={speciesSegments} thin />
                  <BarLegend segments={speciesSegments} />
                </>
              );
            })()}
          </div>
        )}

        {/* Age distribution */}
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '10px', color: C.label, marginBottom: '3px' }}>Age Distribution</div>
          {(() => {
            const ageSegments = [
              { label: 'Young', value: age.young, colour: C.young },
              { label: 'Working', value: age.workingAge, colour: C.workingAge },
              { label: 'Elderly', value: age.elderly, colour: C.elderly },
            ];
            return (
              <>
                <StackedBar segments={ageSegments} thin />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: C.muted, marginTop: '2px' }}>
                  {ageSegments.map((s) => (
                    <span key={s.label}>{s.label}: {pct(s.value, totalAge)}</span>
                  ))}
                </div>
              </>
            );
          })()}
        </div>

        {/* Wealth distribution */}
        {wealth && (
          <div>
            <div style={{ fontSize: '10px', color: C.label, marginBottom: '3px' }}>Wealth Distribution</div>
            {(() => {
              const wealthSegments = [
                { label: 'Elite', value: wealth.wealthyElite, colour: C.elite },
                { label: 'Middle', value: wealth.middleClass, colour: C.middle },
                { label: 'Working', value: wealth.workingClass, colour: C.working },
                { label: 'Destitute', value: wealth.destitute, colour: C.destitute },
              ];
              const gini = calculateGini(wealth);
              const giniColour = gini > 0.5 ? C.danger : gini > 0.3 ? C.warning : C.green;
              return (
                <>
                  <StackedBar segments={wealthSegments} thin />
                  <BarLegend segments={wealthSegments} />
                  <div style={{ ...S_ROW, marginTop: '3px' }}>
                    <span style={{ fontSize: '10px', color: C.label }}>Gini Index</span>
                    <span style={{ fontSize: '10px', color: giniColour, fontWeight: 700 }}>{gini.toFixed(2)}</span>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── Section D: Political & Social (Vic3 aggregation) ────────────── */}
      <div style={S_CARD}>
        <div style={S_SECTION_TITLE}>Political &amp; Social</div>

        {/* Political faction bars */}
        {factions && factions.length > 0 ? (
          <div style={{ marginBottom: '8px' }}>
            {factions
              .filter((f) => !f.dissolved)
              .sort((a, b) => b.supportBase - a.supportBase)
              .map((faction) => {
                const supportPct = faction.supportBase * 100;
                const satColour = getFactionSatisfactionColour(faction.satisfaction);
                const actionColour = getFactionActionColour(faction.currentAction);

                return (
                  <div key={faction.id} style={{ marginBottom: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                      {/* Ruling faction badge */}
                      {faction.isRulingFaction && (
                        <span style={{ fontSize: '10px', color: C.elite }} title="Ruling faction">{'\u2605'}</span>
                      )}
                      <span style={{ fontSize: '10px', color: C.text, fontWeight: 600, flex: 1 }}>
                        {faction.name}
                      </span>
                      {/* Action indicator dot */}
                      <span
                        title={`Action: ${faction.currentAction}`}
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: actionColour,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: '10px', color: C.label, minWidth: '32px', textAlign: 'right' }}>
                        {supportPct.toFixed(0)}%
                      </span>
                    </div>
                    {/* Support bar, coloured by satisfaction */}
                    <div style={{ ...S_STACKED_BAR_THIN, height: '6px' }}>
                      <div style={{
                        width: `${Math.min(supportPct, 100)}%`,
                        height: '100%',
                        background: satColour,
                        borderRadius: '3px',
                        transition: 'width 0.3s',
                      }} />
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <div style={{ fontSize: '10px', color: C.muted, fontStyle: 'italic', marginBottom: '6px' }}>
            No active factions
          </div>
        )}

        {/* Faith distribution */}
        <div style={{ marginBottom: '6px' }}>
          <div style={{ fontSize: '10px', color: C.label, marginBottom: '2px' }}>Faith</div>
          <StackedBar
            thin
            segments={[
              { label: 'Fanatics', value: faith.fanatics, colour: C.fanatics },
              { label: 'Observant', value: faith.observant, colour: C.observant },
              { label: 'Casual', value: faith.casual, colour: C.casual },
              { label: 'Indifferent', value: faith.indifferent, colour: C.indifferent },
              { label: 'Secular', value: faith.secular, colour: C.secular },
            ]}
          />
        </div>

        {/* Loyalty distribution */}
        <div>
          <div style={{ fontSize: '10px', color: C.label, marginBottom: '2px' }}>Loyalty</div>
          <StackedBar
            thin
            segments={[
              { label: 'Loyal', value: loyalty.loyal, colour: C.loyal },
              { label: 'Content', value: loyalty.content, colour: C.content },
              { label: 'Disgruntled', value: loyalty.disgruntled, colour: C.disgruntled },
              { label: 'Rebellious', value: loyalty.rebellious, colour: C.rebellious },
            ]}
          />
          {rebelliousPct > 15 && (
            <div style={{ fontSize: '9px', color: C.danger, marginTop: '2px' }}>
              {'\u26A0'} Revolt risk — rebellious population at {rebelliousPct.toFixed(0)}%
            </div>
          )}
        </div>
      </div>

      {/* ── Section E: Health & Services ─────────────────────────────────── */}
      <div style={S_CARD}>
        <div style={S_SECTION_TITLE}>Health &amp; Services</div>
        <LevelBar value={healthLevel} label="Health Level" />

        {crime && (
          <div style={{ marginTop: '4px' }}>
            <div style={S_ROW}>
              <span style={{ color: C.label, fontSize: '10px' }}>Crime Rate</span>
              <span style={{
                fontSize: '10px',
                fontWeight: 700,
                color: crime.crimeRate > 0.3 ? C.danger : crime.crimeRate > 0.1 ? C.warning : C.green,
              }}>
                {fractionPct(crime.crimeRate)}
              </span>
            </div>
          </div>
        )}

        {employment && (
          <div style={{ marginTop: '4px' }}>
            <div style={S_ROW}>
              <span style={{ color: C.label, fontSize: '10px' }}>Jobs Filled</span>
              <span style={{ fontSize: '10px', color: C.muted }}>
                {formatPop(employment.filledJobs)} / {formatPop(employment.totalJobs)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Section F: Alert Badges Row ──────────────────────────────────── */}
      {alerts && alerts.length > 0 && (
        <div style={S_CARD}>
          <AlertBadges alerts={alerts} />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main component — switches between simplified and full views
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Planet Demographics Dashboard — two-tier display following the
 * GalCiv IV core/colony pattern:
 *
 * - **Simplified view** (< 1M population): compact single-card summary
 * - **Full dashboard** (>= 1M population): six-section MOO2-style breakdown
 *
 * Follows the five golden rules from population UI research:
 * 1. Alpha Centauri traffic-light dots
 * 2. MOO2 single-screen (no sub-tabs)
 * 3. Victoria 3 faction aggregation
 * 4. GalCiv IV two-tier threshold
 * 5. Notification-driven alerts
 */
export function DemographicsPanel({
  demographics,
  growthRate,
  populationHistory,
  factions,
  alerts,
  onAllocationChange,
}: DemographicsPanelProps): React.ReactElement {
  if (demographics.totalPopulation < FULL_DASHBOARD_THRESHOLD) {
    return (
      <SimplifiedView
        demographics={demographics}
        growthRate={growthRate}
        alerts={alerts}
      />
    );
  }

  return (
    <FullDashboard
      demographics={demographics}
      growthRate={growthRate}
      populationHistory={populationHistory}
      factions={factions}
      alerts={alerts}
      onAllocationChange={onAllocationChange}
    />
  );
}
