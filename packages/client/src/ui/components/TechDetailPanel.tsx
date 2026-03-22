import React, { useState, useCallback } from 'react';
import type { Technology, TechEffect } from '@nova-imperia/shared';
import type { ActiveResearch, ResearchState } from '@nova-imperia/shared';
import type { TechCardStatus } from '../screens/ResearchScreen';

interface TechDetailPanelProps {
  tech: Technology;
  status: TechCardStatus;
  researchState: ResearchState;
  /** Base research points per tick (before species bonus) */
  researchPerTick: number;
  /** Species research multiplier (species.traits.research / 5) */
  speciesBonus: number;
  /** Completed tech IDs (for prereq display) */
  completedTechs: Set<string>;
  /** All tech names by id (for human-readable prereq names) */
  techNamesById: Map<string, string>;
  onStartResearch: (techId: string, allocation: number) => void;
  onCancelResearch: (techId: string) => void;
  onAdjustAllocation: (techId: string, allocation: number) => void;
  onClose: () => void;
}

// Human-readable effect label
function formatEffect(effect: TechEffect): string {
  switch (effect.type) {
    case 'unlock_hull':
      return `Unlocks ${effect.hullClass} hull class`;
    case 'unlock_component':
      return `Unlocks component: ${effect.componentId.replace(/_/g, ' ')}`;
    case 'unlock_building':
      return `Unlocks building: ${effect.buildingType.replace(/_/g, ' ')}`;
    case 'stat_bonus':
      return `${effect.value > 0 ? '+' : ''}${effect.value}% ${effect.stat.replace(/_/g, ' ')}`;
    case 'enable_ability':
      return `Enables: ${effect.ability.replace(/_/g, ' ')}`;
    case 'resource_bonus':
      return `${effect.resource} income x${effect.multiplier}`;
    case 'age_unlock':
      return `Advances to Age: ${effect.age.replace(/_/g, ' ')}`;
    default:
      return 'Unknown effect';
  }
}

// Age display names
const AGE_LABELS: Record<string, string> = {
  nano_atomic:  'Nano-Atomic Age',
  fusion:       'Fusion Age',
  nano_fusion:  'Nano-Fusion Age',
  anti_matter:  'Anti-Matter Age',
  singularity:  'Singularity Age',
};

// Category display names
const CATEGORY_LABELS: Record<string, string> = {
  weapons:      'Weapons',
  defense:      'Defense',
  propulsion:   'Propulsion',
  biology:      'Biology',
  construction: 'Construction',
  special:      'Special',
};

export function TechDetailPanel({
  tech,
  status,
  researchState,
  researchPerTick,
  speciesBonus,
  completedTechs,
  techNamesById,
  onStartResearch,
  onCancelResearch,
  onAdjustAllocation,
  onClose,
}: TechDetailPanelProps): React.ReactElement {
  // Find active research entry if this tech is being researched
  const activeEntry: ActiveResearch | undefined = researchState.activeResearch.find(
    (r) => r.techId === tech.id,
  );

  // Current total allocation used by all other active projects
  const otherAllocation = researchState.activeResearch
    .filter((r) => r.techId !== tech.id)
    .reduce((sum, r) => sum + r.allocation, 0);

  const maxAllocation = 100 - otherAllocation;

  // Slider state — initialise from existing or a sensible default
  const [allocationInput, setAllocationInput] = useState<number>(
    activeEntry?.allocation ?? Math.min(25, maxAllocation),
  );

  // Estimated ticks to complete
  function estimatedTicks(allocation: number): number {
    const effective = researchPerTick * speciesBonus * (allocation / 100);
    if (effective <= 0) return Infinity;
    const remaining = activeEntry
      ? tech.cost - activeEntry.pointsInvested
      : tech.cost;
    return Math.ceil(remaining / effective);
  }

  const ticks = estimatedTicks(allocationInput);
  const ticksDisplay = ticks === Infinity ? '—' : `${ticks} turns`;

  const totalAllocationAfter = otherAllocation + allocationInput;
  const overLimit = totalAllocationAfter > 100;

  // Points display for active
  const pointsDisplay = activeEntry
    ? `${Math.floor(activeEntry.pointsInvested)} / ${tech.cost} RP`
    : `0 / ${tech.cost} RP`;

  const progressPercent = activeEntry ? (activeEntry.pointsInvested / tech.cost) * 100 : 0;

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAllocationInput(Number(e.target.value));
  }, []);

  const handleStartResearch = useCallback(() => {
    if (!overLimit) {
      onStartResearch(tech.id, allocationInput);
    }
  }, [tech.id, allocationInput, overLimit, onStartResearch]);

  const handleAdjustAllocation = useCallback(() => {
    onAdjustAllocation(tech.id, allocationInput);
  }, [tech.id, allocationInput, onAdjustAllocation]);

  const handleCancel = useCallback(() => {
    onCancelResearch(tech.id);
    onClose();
  }, [tech.id, onCancelResearch, onClose]);

  return (
    <div className="tech-detail-panel">
      {/* Scrollable body */}
      <div className="tech-detail-panel__body">
      {/* Header */}
      <div className="tech-detail-panel__header">
        <div className="tech-detail-panel__header-info">
          <h2 className="tech-detail-panel__title">{tech.name}</h2>
          <div className="tech-detail-panel__badges">
            <span className={`tech-detail-panel__badge tech-detail-panel__badge--age`}>
              {AGE_LABELS[tech.age] ?? tech.age}
            </span>
            <span className={`tech-detail-panel__badge tech-detail-panel__badge--cat tech-detail-panel__badge--cat-${tech.category}`}>
              {CATEGORY_LABELS[tech.category] ?? tech.category}
            </span>
            <span className={`tech-detail-panel__badge tech-detail-panel__badge--status tech-detail-panel__badge--${status}`}>
              {status.toUpperCase()}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="panel-close-btn"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Description */}
      <p className="tech-detail-panel__desc">{tech.description}</p>

      {/* Cost */}
      <div className="tech-detail-panel__row">
        <span className="tech-detail-panel__row-label">Research Cost</span>
        <span className="tech-detail-panel__row-value">{tech.cost} RP</span>
      </div>

      {/* Active progress bar */}
      {status === 'active' && activeEntry && (
        <div className="tech-detail-panel__progress-section">
          <div className="tech-detail-panel__row">
            <span className="tech-detail-panel__row-label">Progress</span>
            <span className="tech-detail-panel__row-value">{pointsDisplay}</span>
          </div>
          <div className="tech-detail-panel__progress-track">
            <div
              className="tech-detail-panel__progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Effects */}
      {tech.effects.length > 0 && (
        <div className="tech-detail-panel__section">
          <div className="panel-section-label">Effects</div>
          <ul className="tech-detail-panel__effects">
            {tech.effects.map((effect, i) => (
              <li key={i} className="tech-detail-panel__effect-item">
                <span className="tech-detail-panel__effect-bullet">&#9658;</span>
                {formatEffect(effect)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Prerequisites */}
      {tech.prerequisites.length > 0 && (
        <div className="tech-detail-panel__section">
          <div className="panel-section-label">Prerequisites</div>
          <ul className="tech-detail-panel__prereqs">
            {tech.prerequisites.map((prereqId) => {
              const met = completedTechs.has(prereqId);
              const name = techNamesById.get(prereqId) ?? prereqId;
              return (
                <li
                  key={prereqId}
                  className={`tech-detail-panel__prereq ${met ? 'tech-detail-panel__prereq--met' : 'tech-detail-panel__prereq--unmet'}`}
                >
                  <span className="tech-detail-panel__prereq-icon">
                    {met ? '&#10003;' : '&#9675;'}
                  </span>
                  {name}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Locked message */}
      {status === 'locked' && (
        <div className="tech-detail-panel__locked-msg">
          Prerequisites not met. Research the required technologies first.
        </div>
      )}

      {/* Future age message */}
      {status === 'future' && (
        <div className="tech-detail-panel__locked-msg">
          This technology belongs to a future age. Advance your civilization to unlock it.
        </div>
      )}
      </div>{/* end .tech-detail-panel__body */}

      {/* Research controls — sticky footer, only shown when available or active */}
      {(status === 'available' || status === 'active') && (
        <div className="tech-detail-panel__controls tech-detail-panel__controls--sticky">
          <div className="panel-section-label">
            {status === 'active' ? 'Adjust Allocation' : 'Start Research'}
          </div>

          {/* Allocation slider */}
          <div className="tech-detail-panel__alloc-row">
            <label className="tech-detail-panel__alloc-label" htmlFor={`alloc-${tech.id}`}>
              Allocation
            </label>
            <span className="tech-detail-panel__alloc-value">
              {allocationInput}%
            </span>
          </div>
          <input
            id={`alloc-${tech.id}`}
            type="range"
            min={0}
            max={maxAllocation}
            value={allocationInput}
            onChange={handleSliderChange}
            className="tech-detail-panel__alloc-slider"
          />
          <div className="tech-detail-panel__alloc-hints">
            <span className={overLimit ? 'tech-detail-panel__alloc-warn' : 'tech-detail-panel__alloc-hint'}>
              Total: {totalAllocationAfter}% / 100%
              {overLimit && '  — OVER LIMIT'}
            </span>
            <span className="tech-detail-panel__alloc-hint">
              {ticks !== Infinity ? `~${ticksDisplay}` : 'Set allocation to estimate'}
            </span>
          </div>

          {/* Action buttons */}
          <div className="tech-detail-panel__actions">
            {status === 'available' && (
              <button
                type="button"
                className={`tech-detail-panel__btn tech-detail-panel__btn--start ${overLimit || allocationInput === 0 ? 'tech-detail-panel__btn--disabled' : ''}`}
                onClick={handleStartResearch}
                disabled={overLimit || allocationInput === 0}
              >
                Start Research
              </button>
            )}
            {status === 'active' && (
              <>
                <button
                  type="button"
                  className={`tech-detail-panel__btn tech-detail-panel__btn--adjust ${overLimit ? 'tech-detail-panel__btn--disabled' : ''}`}
                  onClick={handleAdjustAllocation}
                  disabled={overLimit}
                >
                  Apply
                </button>
                <button
                  type="button"
                  className="tech-detail-panel__btn tech-detail-panel__btn--cancel"
                  onClick={handleCancel}
                >
                  Cancel Research
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
