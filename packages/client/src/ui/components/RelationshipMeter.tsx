import React from 'react';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface RelationshipMeterProps {
  /** Visual label above the meter */
  label: string;
  /** Current value */
  value: number;
  /** Minimum possible value (e.g. -100 for attitude, 0 for trust) */
  min: number;
  /** Maximum possible value (e.g. 100) */
  max: number;
  /**
   * When true the bar renders as bidirectional: the midpoint is 0,
   * negative fills left (red), positive fills right (green).
   * When false a standard left-to-right fill bar is rendered (cyan).
   */
  bidirectional?: boolean;
  /** Extra className applied to root element */
  className?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Map a value in [min, max] to a 0-100 percentage. */
function toPercent(value: number, min: number, max: number): number {
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

/** Derive a colour for a bidirectional attitude value in [-100, 100]. */
function attitudeColor(value: number): string {
  if (value >= 60)  return '#00e676'; // strong positive – bright green
  if (value >= 20)  return '#69f0ae'; // positive        – mid green
  if (value >= -20) return '#ffd740'; // neutral          – amber
  if (value >= -60) return '#ff6d00'; // negative         – orange
  return '#f44336';                    // strongly hostile  – red
}

/** Derive a colour for a trust value in [0, 100]. */
function trustColor(value: number): string {
  if (value >= 70) return '#00e5ff';
  if (value >= 40) return '#00b8d4';
  return '#607d8b';
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RelationshipMeter({
  label,
  value,
  min,
  max,
  bidirectional = false,
  className = '',
}: RelationshipMeterProps): React.ReactElement {
  const clampedValue = Math.max(min, Math.min(max, value));
  const displayValue = Math.round(clampedValue);

  // ── Bidirectional (attitude) rendering ──────────────────────────────────
  if (bidirectional) {
    const zeroPercent = toPercent(0, min, max);          // centre line position
    const valuePercent = toPercent(clampedValue, min, max);
    const isPositive = clampedValue >= 0;
    const fillLeft   = isPositive ? zeroPercent : valuePercent;
    const fillWidth  = Math.abs(valuePercent - zeroPercent);
    const fillColor  = attitudeColor(clampedValue);

    return (
      <div className={`rel-meter ${className}`}>
        <div className="rel-meter__header">
          <span className="rel-meter__label">{label}</span>
          <span
            className="rel-meter__value"
            style={{ color: fillColor }}
          >
            {displayValue > 0 ? `+${displayValue}` : displayValue}
          </span>
        </div>
        <div className="rel-meter__track rel-meter__track--bidir">
          {/* Negative label */}
          <span className="rel-meter__track-end rel-meter__track-end--neg">HOSTILE</span>
          {/* Fill region */}
          <div className="rel-meter__track-inner">
            <div
              className="rel-meter__fill rel-meter__fill--bidir"
              style={{
                left: `${fillLeft}%`,
                width: `${fillWidth}%`,
                background: fillColor,
                boxShadow: `0 0 6px ${fillColor}88`,
              }}
            />
            {/* Centre tick */}
            <div
              className="rel-meter__centre-tick"
              style={{ left: `${zeroPercent}%` }}
            />
          </div>
          {/* Positive label */}
          <span className="rel-meter__track-end rel-meter__track-end--pos">FRIENDLY</span>
        </div>
      </div>
    );
  }

  // ── Standard (trust) rendering ───────────────────────────────────────────
  const fillPercent = toPercent(clampedValue, min, max);
  const fillColor   = trustColor(clampedValue);

  return (
    <div className={`rel-meter ${className}`}>
      <div className="rel-meter__header">
        <span className="rel-meter__label">{label}</span>
        <span
          className="rel-meter__value"
          style={{ color: fillColor }}
        >
          {displayValue}
        </span>
      </div>
      <div className="rel-meter__track">
        <div className="rel-meter__track-inner">
          <div
            className="rel-meter__fill"
            style={{
              width: `${fillPercent}%`,
              background: fillColor,
              boxShadow: `0 0 6px ${fillColor}88`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
