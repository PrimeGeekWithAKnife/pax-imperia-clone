import React from 'react';
import type { PlanetDemographics, VocationDistribution } from '@nova-imperia/shared';

// ── Props ────────────────────────────────────────────────────────────────────

export interface DemographicsPanelProps {
  demographics: PlanetDemographics;
  /** Population growth rate as a fraction per tick (e.g. 0.002 = 0.2% per day). */
  growthRate?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

/** Determine settlement tier label from population count. */
function getSettlementTierLabel(population: number): string {
  if (population >= 500_000_000) return 'Planetary';
  if (population >= 50_000_000) return 'Megatropolis';
  if (population >= 5_000_000) return 'Metropolis';
  if (population >= 500_000) return 'City';
  if (population >= 50_000) return 'Small City';
  if (population >= 5_000) return 'Colony';
  if (population >= 500) return 'Settlement';
  return 'Habitat';
}

// ── Colour constants ─────────────────────────────────────────────────────────

const COLOURS = {
  // Age pyramid
  young: '#4488cc',
  workingAge: '#44aa66',
  elderly: '#cc9944',

  // Vocations
  scientists: '#22aadd',
  workers: '#aa8833',
  military: '#cc4444',
  merchants: '#ddaa22',
  administrators: '#8866cc',
  educators: '#44bbaa',
  medical: '#44cc88',
  general: '#888888',

  // Wealth
  wealthyElite: '#ffcc33',
  middleClass: '#44aa66',
  workingClass: '#4488cc',
  destitute: '#cc4444',

  // Faith
  fanatics: '#992222',
  observant: '#cc8833',
  casual: '#cccc44',
  indifferent: '#888888',
  secular: '#4488cc',

  // Loyalty
  loyal: '#44aa44',
  content: '#88cc88',
  disgruntled: '#cc8833',
  rebellious: '#cc3333',

  // Health thresholds
  healthGood: '#44aa66',
  healthFair: '#ccaa33',
  healthPoor: '#cc4444',

  // Misc
  muted: '#556677',
  label: '#8899aa',
  text: '#ccdde8',
  heading: '#aabbcc',
  sectionBg: 'rgba(255,255,255,0.03)',
  sectionBorder: 'rgba(255,255,255,0.08)',
  growthPositive: '#44cc88',
  growthNegative: '#cc4444',
  growthZero: '#888888',
  warning: '#ffaa33',
  danger: '#cc4444',
} as const;

// ── Inline-style primitives ──────────────────────────────────────────────────

const S_PANEL: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  fontFamily: 'monospace',
  fontSize: '12px',
  color: COLOURS.text,
  maxHeight: '100%',
  overflowY: 'auto',
  padding: '8px',
};

const S_SECTION: React.CSSProperties = {
  background: COLOURS.sectionBg,
  border: `1px solid ${COLOURS.sectionBorder}`,
  borderRadius: '4px',
  padding: '8px',
};

const S_SECTION_TITLE: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 'bold',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: COLOURS.heading,
  marginBottom: '6px',
};

const S_ROW: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '2px',
};

const S_STACKED_BAR: React.CSSProperties = {
  display: 'flex',
  height: '14px',
  borderRadius: '3px',
  overflow: 'hidden',
  width: '100%',
  marginTop: '4px',
  marginBottom: '4px',
};

const S_LEGEND_ROW: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
  marginTop: '2px',
};

const S_LEGEND_ITEM: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '3px',
  fontSize: '10px',
  color: COLOURS.label,
};

const S_COLOUR_DOT = (colour: string): React.CSSProperties => ({
  width: '8px',
  height: '8px',
  borderRadius: '2px',
  background: colour,
  flexShrink: 0,
});

const S_NO_DATA: React.CSSProperties = {
  color: COLOURS.muted,
  fontStyle: 'italic',
  fontSize: '11px',
  padding: '4px 0',
};

// ── Sub-components ───────────────────────────────────────────────────────────

/** Horizontal stacked bar from an array of { label, value, colour } segments. */
function StackedBar({ segments }: {
  segments: Array<{ label: string; value: number; colour: string }>;
}): React.ReactElement {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return <div style={S_NO_DATA}>No data</div>;

  return (
    <>
      <div style={S_STACKED_BAR}>
        {segments.map((seg) => {
          const w = (seg.value / total) * 100;
          if (w < 0.5) return null;
          return (
            <div
              key={seg.label}
              title={`${seg.label}: ${pct(seg.value, total)}`}
              style={{
                width: `${w}%`,
                background: seg.colour,
                transition: 'width 0.3s',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                color: '#111',
                fontWeight: 'bold',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              {w > 10 ? `${w.toFixed(0)}%` : ''}
            </div>
          );
        })}
      </div>
      <div style={S_LEGEND_ROW}>
        {segments.map((seg) => {
          const w = (seg.value / total) * 100;
          if (w < 0.5) return null;
          return (
            <span key={seg.label} style={S_LEGEND_ITEM}>
              <span style={S_COLOUR_DOT(seg.colour)} />
              {seg.label} {pct(seg.value, total)}
            </span>
          );
        })}
      </div>
    </>
  );
}

/** Simple horizontal bar from 0-100. */
function LevelBar({ value, label, lowThreshold = 40, highThreshold = 70 }: {
  value: number;
  label: string;
  lowThreshold?: number;
  highThreshold?: number;
}): React.ReactElement {
  const clamped = Math.max(0, Math.min(100, value));
  const colour = clamped >= highThreshold
    ? COLOURS.healthGood
    : clamped >= lowThreshold
      ? COLOURS.healthFair
      : COLOURS.healthPoor;

  return (
    <div style={{ marginBottom: '4px' }}>
      <div style={S_ROW}>
        <span style={{ color: COLOURS.label }}>{label}</span>
        <span style={{ color: colour, fontWeight: 'bold' }}>{clamped.toFixed(0)}</span>
      </div>
      <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${clamped}%`, height: '100%', background: colour, borderRadius: '3px', transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

// ── Vocation display config ──────────────────────────────────────────────────

const VOCATION_CONFIG: Array<{ key: keyof VocationDistribution; label: string; colour: string }> = [
  { key: 'scientists', label: 'Scientists', colour: COLOURS.scientists },
  { key: 'workers', label: 'Workers', colour: COLOURS.workers },
  { key: 'military', label: 'Military', colour: COLOURS.military },
  { key: 'merchants', label: 'Merchants', colour: COLOURS.merchants },
  { key: 'administrators', label: 'Administrators', colour: COLOURS.administrators },
  { key: 'educators', label: 'Educators', colour: COLOURS.educators },
  { key: 'medical', label: 'Medical', colour: COLOURS.medical },
  { key: 'general', label: 'General', colour: COLOURS.general },
];

const VOCATION_LABEL_MAP: Record<string, string> = {
  scientists: 'Scientists',
  workers: 'Workers',
  military: 'Military',
  merchants: 'Merchants',
  administrators: 'Administrators',
  educators: 'Educators',
  medical: 'Medical',
  general: 'General',
};

// ── Main component ───────────────────────────────────────────────────────────

/**
 * Planet Demographics Dashboard — a compact panel showing the demographic
 * breakdown of a colony's population. Designed to be embedded within the
 * planet management screen alongside the building grid.
 */
export function DemographicsPanel({
  demographics,
  growthRate,
}: DemographicsPanelProps): React.ReactElement {
  const { totalPopulation, age, vocations, faith, loyalty, healthLevel, wealth, employment, crime } = demographics;

  const totalAge = age.young + age.workingAge + age.elderly;
  const tierLabel = getSettlementTierLabel(totalPopulation);

  // Growth rate display
  const growthColour = growthRate === undefined
    ? COLOURS.growthZero
    : growthRate > 0
      ? COLOURS.growthPositive
      : growthRate < 0
        ? COLOURS.growthNegative
        : COLOURS.growthZero;
  const growthText = growthRate === undefined
    ? '--'
    : `${growthRate >= 0 ? '+' : ''}${(growthRate * 100).toFixed(2)}%/day`;

  return (
    <div style={S_PANEL} className="demographics-panel">
      {/* ── 1. Population Summary ──────────────────────────────────────── */}
      <div style={S_SECTION}>
        <div style={S_SECTION_TITLE}>Population Summary</div>
        <div style={S_ROW}>
          <span style={{ color: COLOURS.label }}>Total</span>
          <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{formatPop(totalPopulation)}</span>
        </div>
        <div style={S_ROW}>
          <span style={{ color: COLOURS.label }}>Growth Rate</span>
          <span style={{ color: growthColour, fontWeight: 'bold' }}>{growthText}</span>
        </div>
        <div style={S_ROW}>
          <span style={{ color: COLOURS.label }}>Settlement Tier</span>
          <span style={{ color: COLOURS.heading }}>{tierLabel}</span>
        </div>
      </div>

      {/* ── 2. Age Pyramid ─────────────────────────────────────────────── */}
      <div style={S_SECTION}>
        <div style={S_SECTION_TITLE}>Age Distribution</div>
        <StackedBar
          segments={[
            { label: 'Young', value: age.young, colour: COLOURS.young },
            { label: 'Working Age', value: age.workingAge, colour: COLOURS.workingAge },
            { label: 'Elderly', value: age.elderly, colour: COLOURS.elderly },
          ]}
        />
        {totalAge > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: COLOURS.muted, marginTop: '2px' }}>
            <span>Young: {formatPop(age.young)}</span>
            <span>Working: {formatPop(age.workingAge)}</span>
            <span>Elderly: {formatPop(age.elderly)}</span>
          </div>
        )}
      </div>

      {/* ── 3. Vocation Breakdown ──────────────────────────────────────── */}
      <div style={S_SECTION}>
        <div style={S_SECTION_TITLE}>Vocations</div>
        <StackedBar
          segments={VOCATION_CONFIG.map((v) => ({
            label: v.label,
            value: vocations[v.key],
            colour: v.colour,
          }))}
        />
        {/* Per-vocation list with bars */}
        <div style={{ marginTop: '4px' }}>
          {VOCATION_CONFIG.map((v) => {
            const count = vocations[v.key];
            const barWidth = age.workingAge > 0 ? pctNum(count, age.workingAge) : 0;
            const gap = employment?.skillGaps[v.key];
            return (
              <div key={v.key} style={{ marginBottom: '3px' }}>
                <div style={{ ...S_ROW, marginBottom: '1px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={S_COLOUR_DOT(v.colour)} />
                    <span style={{ color: COLOURS.label }}>{v.label}</span>
                  </span>
                  <span>
                    {formatPop(count)}
                    <span style={{ color: COLOURS.muted, marginLeft: '4px' }}>
                      ({pct(count, age.workingAge)})
                    </span>
                  </span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(barWidth, 100)}%`, height: '100%', background: v.colour, borderRadius: '2px' }} />
                </div>
                {gap !== undefined && gap > 0 && (
                  <div style={{ fontSize: '10px', color: COLOURS.warning, marginTop: '1px' }}>
                    Need {formatPop(gap)} more {v.label.toLowerCase()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 4. Wealth Distribution ─────────────────────────────────────── */}
      {wealth ? (
        <div style={S_SECTION}>
          <div style={S_SECTION_TITLE}>Wealth Distribution</div>
          <StackedBar
            segments={[
              { label: 'Wealthy Elite', value: wealth.wealthyElite, colour: COLOURS.wealthyElite },
              { label: 'Middle Class', value: wealth.middleClass, colour: COLOURS.middleClass },
              { label: 'Working Class', value: wealth.workingClass, colour: COLOURS.workingClass },
              { label: 'Destitute', value: wealth.destitute, colour: COLOURS.destitute },
            ]}
          />
          {/* Gini coefficient approximation from the four-band model */}
          <GiniDisplay wealth={wealth} />
        </div>
      ) : null}

      {/* ── 5. Faith Distribution ──────────────────────────────────────── */}
      <div style={S_SECTION}>
        <div style={S_SECTION_TITLE}>Faith Distribution</div>
        <StackedBar
          segments={[
            { label: 'Fanatics', value: faith.fanatics, colour: COLOURS.fanatics },
            { label: 'Observant', value: faith.observant, colour: COLOURS.observant },
            { label: 'Casual', value: faith.casual, colour: COLOURS.casual },
            { label: 'Indifferent', value: faith.indifferent, colour: COLOURS.indifferent },
            { label: 'Secular', value: faith.secular, colour: COLOURS.secular },
          ]}
        />
      </div>

      {/* ── 6. Loyalty Distribution ────────────────────────────────────── */}
      <div style={S_SECTION}>
        <div style={S_SECTION_TITLE}>Loyalty Distribution</div>
        <StackedBar
          segments={[
            { label: 'Loyal', value: loyalty.loyal, colour: COLOURS.loyal },
            { label: 'Content', value: loyalty.content, colour: COLOURS.content },
            { label: 'Disgruntled', value: loyalty.disgruntled, colour: COLOURS.disgruntled },
            { label: 'Rebellious', value: loyalty.rebellious, colour: COLOURS.rebellious },
          ]}
        />
        {/* Warn if rebellious segment is significant */}
        {loyalty.rebellious > 0 && pctNum(loyalty.rebellious, loyalty.loyal + loyalty.content + loyalty.disgruntled + loyalty.rebellious) > 15 && (
          <div style={{ fontSize: '10px', color: COLOURS.danger, marginTop: '2px' }}>
            Unrest is dangerously high — risk of revolt
          </div>
        )}
      </div>

      {/* ── 7. Health & Crime ──────────────────────────────────────────── */}
      <div style={S_SECTION}>
        <div style={S_SECTION_TITLE}>Health &amp; Crime</div>
        <LevelBar value={healthLevel} label="Health Level" />

        {crime ? (
          <>
            <div style={{ marginTop: '6px' }}>
              <div style={S_ROW}>
                <span style={{ color: COLOURS.label }}>Crime Rate</span>
                <span style={{ color: crime.crimeRate > 0.3 ? COLOURS.danger : crime.crimeRate > 0.1 ? COLOURS.warning : COLOURS.healthGood }}>
                  {fractionPct(crime.crimeRate)}
                </span>
              </div>
              <div style={S_ROW}>
                <span style={{ color: COLOURS.label }}>Organised Crime</span>
                <span style={{ color: crime.organisedCrimePresence > 0.2 ? COLOURS.danger : COLOURS.muted }}>
                  {fractionPct(crime.organisedCrimePresence)}
                </span>
              </div>
              <div style={S_ROW}>
                <span style={{ color: COLOURS.label }}>Law Enforcement</span>
                <span style={{ color: crime.lawEnforcementEffectiveness > 0.6 ? COLOURS.healthGood : crime.lawEnforcementEffectiveness > 0.3 ? COLOURS.healthFair : COLOURS.healthPoor }}>
                  {fractionPct(crime.lawEnforcementEffectiveness)}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div style={S_NO_DATA}>No crime data available</div>
        )}

        {employment ? (
          <div style={{ marginTop: '6px' }}>
            <div style={S_ROW}>
              <span style={{ color: COLOURS.label }}>Employment Rate</span>
              <span style={{ color: employment.unemploymentRate > 0.15 ? COLOURS.danger : employment.unemploymentRate > 0.05 ? COLOURS.warning : COLOURS.healthGood, fontWeight: 'bold' }}>
                {fractionPct(1 - employment.unemploymentRate)}
              </span>
            </div>
            <div style={S_ROW}>
              <span style={{ color: COLOURS.label }}>Jobs Filled</span>
              <span style={{ color: COLOURS.muted }}>
                {formatPop(employment.filledJobs)} / {formatPop(employment.totalJobs)}
              </span>
            </div>
            {employment.labourShortage && (
              <div style={{ fontSize: '10px', color: COLOURS.warning, marginTop: '2px' }}>
                Labour shortage — not enough workers to fill all positions
              </div>
            )}
          </div>
        ) : (
          <div style={S_NO_DATA}>No employment data available</div>
        )}
      </div>

      {/* ── 8. Trend Projections (placeholder) ─────────────────────────── */}
      <div style={S_SECTION}>
        <div style={S_SECTION_TITLE}>Trend Projections</div>
        <TrendProjections demographics={demographics} growthRate={growthRate} />
      </div>
    </div>
  );
}

// ── Gini coefficient approximation ───────────────────────────────────────────

function GiniDisplay({ wealth }: {
  wealth: NonNullable<PlanetDemographics['wealth']>;
}): React.ReactElement {
  // Approximate Gini from four population bands.
  // Each band is assigned a nominal relative income:
  //   destitute=0.05, workingClass=0.3, middleClass=0.7, wealthyElite=2.0
  // Then calculate mean absolute difference / (2 * mean).
  const bands = [
    { share: wealth.destitute, income: 0.05 },
    { share: wealth.workingClass, income: 0.3 },
    { share: wealth.middleClass, income: 0.7 },
    { share: wealth.wealthyElite, income: 2.0 },
  ];

  const totalShare = bands.reduce((s, b) => s + b.share, 0);
  if (totalShare === 0) return <div style={S_NO_DATA}>No wealth data</div>;

  const meanIncome = bands.reduce((s, b) => s + b.share * b.income, 0) / totalShare;
  if (meanIncome === 0) return <div style={S_NO_DATA}>No wealth data</div>;

  let sumAbsDiff = 0;
  for (const a of bands) {
    for (const b of bands) {
      sumAbsDiff += a.share * b.share * Math.abs(a.income - b.income);
    }
  }
  const gini = sumAbsDiff / (2 * totalShare * totalShare * meanIncome);
  const clampedGini = Math.max(0, Math.min(1, gini));

  const giniColour = clampedGini > 0.5 ? COLOURS.danger : clampedGini > 0.3 ? COLOURS.warning : COLOURS.healthGood;

  return (
    <div style={{ ...S_ROW, marginTop: '4px' }}>
      <span style={{ color: COLOURS.label }}>Gini Index</span>
      <span style={{ color: giniColour, fontWeight: 'bold' }}>
        {clampedGini.toFixed(2)}
      </span>
    </div>
  );
}

// ── Trend projections (placeholder logic) ────────────────────────────────────

function TrendProjections({ demographics, growthRate }: {
  demographics: PlanetDemographics;
  growthRate?: number;
}): React.ReactElement {
  const warnings: Array<{ text: string; colour: string }> = [];

  const { age, vocations, employment } = demographics;
  const totalAge = age.young + age.workingAge + age.elderly;

  // Ageing workforce warning
  if (totalAge > 0) {
    const elderlyPct = (age.elderly / totalAge) * 100;
    if (elderlyPct > 30) {
      warnings.push({
        text: `Elderly population at ${elderlyPct.toFixed(0)}% — workforce shrinkage imminent`,
        colour: COLOURS.warning,
      });
    }
  }

  // Low youth replacement
  if (totalAge > 0) {
    const youngPct = (age.young / totalAge) * 100;
    if (youngPct < 15) {
      warnings.push({
        text: `Youth population at only ${youngPct.toFixed(0)}% — future labour deficit likely`,
        colour: COLOURS.warning,
      });
    }
  }

  // Negative growth
  if (growthRate !== undefined && growthRate < 0) {
    const daysToHalve = Math.abs(Math.log(0.5) / growthRate);
    warnings.push({
      text: `At current rates: population halves in ${Math.round(daysToHalve)} days`,
      colour: COLOURS.danger,
    });
  }

  // Labour shortage escalation
  if (employment?.labourShortage) {
    const totalGap = (Object.values(employment.skillGaps) as number[]).reduce((s: number, v: number) => s + v, 0);
    if (totalGap > 0 && growthRate !== undefined && growthRate > 0) {
      const daysToFill = totalGap / (demographics.totalPopulation * growthRate);
      if (daysToFill > 0 && isFinite(daysToFill)) {
        warnings.push({
          text: `Workforce gap of ${formatPop(totalGap)} — estimated ${Math.round(daysToFill)} days to fill at current growth`,
          colour: COLOURS.warning,
        });
      }
    }
  }

  // Scientist deficit
  if (vocations.scientists === 0 && age.workingAge > 100) {
    warnings.push({
      text: 'No scientists — research output is zero',
      colour: COLOURS.danger,
    });
  }

  // High rebellious
  const totalLoyalty = demographics.loyalty.loyal + demographics.loyalty.content + demographics.loyalty.disgruntled + demographics.loyalty.rebellious;
  if (totalLoyalty > 0) {
    const rebelliousPct = (demographics.loyalty.rebellious / totalLoyalty) * 100;
    if (rebelliousPct > 20) {
      warnings.push({
        text: `Rebellious population at ${rebelliousPct.toFixed(0)}% — civil unrest likely within days`,
        colour: COLOURS.danger,
      });
    }
  }

  if (warnings.length === 0) {
    return (
      <div style={{ color: COLOURS.healthGood, fontSize: '11px' }}>
        No critical projections — demographics are stable
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      {warnings.map((w, i) => (
        <div key={i} style={{ fontSize: '10px', color: w.colour, lineHeight: '1.3' }}>
          {w.colour === COLOURS.danger ? '\u26A0 ' : '\u25B6 '}{w.text}
        </div>
      ))}
    </div>
  );
}
