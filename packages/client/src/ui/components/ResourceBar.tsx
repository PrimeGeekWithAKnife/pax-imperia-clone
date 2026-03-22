import React from 'react';

interface ResourceBarProps {
  /** Short label, e.g. "Credits" or "Research" */
  label: string;
  /** Single character icon or emoji */
  icon: string;
  /** The production value (can be negative) */
  value: number;
  /** Compact mode shows icon + value inline; expanded shows label below */
  compact?: boolean;
  /** If true, render the value with a +/- sign prefix */
  showSign?: boolean;
}

/**
 * Displays a single resource with icon, label and color-coded value.
 * Positive values are green, negative values are red, zero is muted.
 */
export function ResourceBar({
  label,
  icon,
  value,
  compact = false,
  showSign = false,
}: ResourceBarProps): React.ReactElement {
  const colorClass =
    value > 0 ? 'res-bar__value--positive'
    : value < 0 ? 'res-bar__value--negative'
    : 'res-bar__value--zero';

  const displayValue = showSign && value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);

  if (compact) {
    return (
      <div className="res-bar res-bar--compact">
        <span className="res-bar__icon">{icon}</span>
        <span className="res-bar__label-compact">{label}</span>
        <span className={`res-bar__value ${colorClass}`}>{displayValue}</span>
      </div>
    );
  }

  return (
    <div className="res-bar res-bar--expanded">
      <div className="res-bar__left">
        <span className="res-bar__icon">{icon}</span>
        <span className="res-bar__label">{label}</span>
      </div>
      <span className={`res-bar__value ${colorClass}`}>{displayValue}</span>
    </div>
  );
}
