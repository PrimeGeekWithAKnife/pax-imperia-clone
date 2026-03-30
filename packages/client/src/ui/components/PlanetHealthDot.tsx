import React from 'react';

// ── Colour thresholds (Alpha Centauri traffic-light system) ─────────────────

const COLOUR_GREEN = '#10b981';
const COLOUR_AMBER = '#f59e0b';
const COLOUR_RED = '#ef4444';

function getHealthColour(value: number): string {
  if (value > 70) return COLOUR_GREEN;
  if (value >= 40) return COLOUR_AMBER;
  return COLOUR_RED;
}

// ── Props ───────────────────────────────────────────────────────────────────

export interface PlanetHealthDotProps {
  /** Health / happiness / stability value from 0 to 100. */
  value: number;
  /** Diameter in pixels. Defaults to 12. */
  size?: number;
  /** Optional inline style overrides. */
  style?: React.CSSProperties;
}

// ── Component ───────────────────────────────────────────────────────────────

/**
 * Traffic-light health indicator — a small coloured circle.
 *
 * Green (> 70), amber (40-70), red (< 40).
 * Designed for use in the outliner, planet list, galaxy map overlays,
 * and anywhere a quick at-a-glance status is needed.
 */
export function PlanetHealthDot({
  value,
  size = 12,
  style,
}: PlanetHealthDotProps): React.ReactElement {
  const colour = getHealthColour(value);
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <span
      title={`Health: ${clamped.toFixed(0)}/100`}
      style={{
        display: 'inline-block',
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: colour,
        boxShadow: `0 0 ${Math.round(size * 0.4)}px ${colour}44`,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
