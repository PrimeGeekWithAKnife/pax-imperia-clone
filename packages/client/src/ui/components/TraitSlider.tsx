import React, { useState } from 'react';

interface TraitSliderProps {
  label: string;
  description: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  overBudget?: boolean;
}

export function TraitSlider({
  label,
  description,
  value,
  min = 1,
  max = 10,
  onChange,
  overBudget = false,
}: TraitSliderProps): React.ReactElement {
  const [showTooltip, setShowTooltip] = useState(false);

  const pct = ((value - min) / (max - min)) * 100;
  const barColor = overBudget ? '#ff4444' : value >= 8 ? '#00d4ff' : value >= 5 ? '#44aaff' : '#336688';

  return (
    <div className="trait-slider">
      <div
        className="trait-slider__header"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className="trait-slider__label">{label}</span>
        <span className="trait-slider__hint">?</span>
        {showTooltip && (
          <div className="trait-slider__tooltip">{description}</div>
        )}
        <span
          className="trait-slider__value"
          style={{ color: overBudget ? '#ff4444' : value >= 8 ? '#00d4ff' : 'var(--color-text)' }}
        >
          {value}
        </span>
      </div>

      <div className="trait-slider__track-wrapper">
        <span className="trait-slider__min-label">{min}</span>
        <div className="trait-slider__track">
          <div
            className="trait-slider__fill"
            style={{
              width: `${pct}%`,
              background: barColor,
              boxShadow: value >= 8 ? `0 0 6px ${barColor}` : 'none',
            }}
          />
          <input
            type="range"
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="trait-slider__input"
          />
        </div>
        <span className="trait-slider__max-label">{max}</span>
      </div>
    </div>
  );
}
