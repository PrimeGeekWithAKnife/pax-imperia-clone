import React, { useState, useMemo, useCallback } from 'react';
import type { Technology } from '@nova-imperia/shared';
import type { TechCategory } from '@nova-imperia/shared';
import type { TechAge } from '@nova-imperia/shared';
import type { ResearchState, ActiveResearch } from '@nova-imperia/shared';
import { getAvailableTechs, getResearchSpeed } from '@nova-imperia/shared';
import { TechCard } from '../components/TechCard';
import { TechDetailPanel } from '../components/TechDetailPanel';

// ── Public status type used by TechCard and TechDetailPanel ─────────────────
export type TechCardStatus = 'completed' | 'available' | 'active' | 'locked' | 'future';

// ── Constants ────────────────────────────────────────────────────────────────

const TECH_AGES_ORDERED: TechAge[] = [
  'nano_atomic',
  'fusion',
  'nano_fusion',
  'anti_matter',
  'singularity',
];

const AGE_DISPLAY_NAMES: Record<TechAge, string> = {
  nano_atomic:  'Nano-Atomic Age',
  fusion:       'Fusion Age',
  nano_fusion:  'Nano-Fusion Age',
  anti_matter:  'Anti-Matter Age',
  singularity:  'Singularity Age',
};

const AGE_SHORT_NAMES: Record<TechAge, string> = {
  nano_atomic:  'Nano-Atomic',
  fusion:       'Fusion',
  nano_fusion:  'Nano-Fusion',
  anti_matter:  'Anti-Matter',
  singularity:  'Singularity',
};

const CATEGORIES_ORDERED: TechCategory[] = [
  'weapons',
  'defense',
  'propulsion',
  'biology',
  'construction',
  'racial',
];

const CATEGORY_DISPLAY_NAMES: Record<TechCategory, string> = {
  weapons:      'Weapons',
  defense:      'Defence',
  propulsion:   'Propulsion',
  biology:      'Biology',
  construction: 'Construction',
  racial:       'Racial',
};

const CATEGORY_DESCRIPTIONS: Record<TechCategory, string> = {
  weapons:      'Offensive systems — beams, projectiles, missiles, fighters',
  defense:      'Protective systems — shields, armour, point defence, countermeasures',
  propulsion:   'Movement — FTL drives, wormhole tech, tactical engines',
  biology:      'Life sciences — medicine, terraforming, population, genetics',
  construction: 'Engineering — buildings, shipyards, computing, materials',
  racial:       'Species-unique technologies tied to your race\'s origin',
};

const MAX_ACTIVE_RESEARCH = 5;

// ── Props ────────────────────────────────────────────────────────────────────

export interface ResearchScreenProps {
  allTechs: Technology[];
  researchState: ResearchState;
  /** Base research points generated per tick (before species bonus) */
  researchPerTick: number;
  /** Species research multiplier (species.traits.research / 5) */
  speciesBonus: number;
  /** Species ID used to filter species-specific techs */
  speciesId?: string;
  onStartResearch: (techId: string, allocation: number) => void;
  onCancelResearch: (techId: string) => void;
  onQueueResearch?: (techId: string) => void;
  onDequeueResearch?: (techId: string) => void;
  onAdjustAllocation: (techId: string, allocation: number) => void;
  /** Max simultaneous active research slots (= research lab count, capped at 5). */
  maxActiveResearch?: number;
  onClose: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function ageIndex(age: TechAge): number {
  return TECH_AGES_ORDERED.indexOf(age);
}

function getTechStatus(
  tech: Technology,
  researchState: ResearchState,
  availableIds: Set<string>,
  activeIds: Set<string>,
): TechCardStatus {
  if (researchState.completedTechs.includes(tech.id)) return 'completed';
  if (activeIds.has(tech.id)) return 'active';
  if (availableIds.has(tech.id)) return 'available';
  // Determine whether it's locked due to age or prerequisites
  if (ageIndex(tech.age) > ageIndex(researchState.currentAge)) return 'future';
  return 'locked';
}

// ── ActiveResearchList sub-component ─────────────────────────────────────────

interface ActiveResearchListProps {
  activeResearch: ActiveResearch[];
  techById: Map<string, Technology>;
  totalAllocation: number;
  researchPerTick: number;
  speciesBonus: number;
  selectedTechId: string | undefined;
  maxActiveResearch: number;
  onCardClick: (tech: Technology) => void;
  onCancelResearch: (techId: string) => void;
  onAdjustAllocation: (techId: string, allocation: number) => void;
}

/** Inline active-research item with its own allocation slider and cancel button. */
function ActiveResearchItem({
  active,
  tech,
  researchPerTick,
  speciesBonus,
  otherAllocation,
  isSelected,
  onCardClick,
  onCancelResearch,
  onAdjustAllocation,
}: {
  active: ActiveResearch;
  tech: Technology;
  researchPerTick: number;
  speciesBonus: number;
  otherAllocation: number;
  isSelected: boolean;
  onCardClick: (tech: Technology) => void;
  onCancelResearch: (techId: string) => void;
  onAdjustAllocation: (techId: string, allocation: number) => void;
}): React.ReactElement {
  const [localAlloc, setLocalAlloc] = useState<number>(active.allocation);
  const progressPercent = (active.pointsInvested / tech.cost) * 100;
  const maxAlloc = Math.min(100, 100 - otherAllocation + active.allocation);

  // Keep local value in sync when the parent allocation changes (e.g. after apply)
  React.useEffect(() => {
    setLocalAlloc(active.allocation);
  }, [active.allocation]);

  const remainingCost = Math.max(0, tech.cost - active.pointsInvested);
  const ticks = getResearchSpeed(
    remainingCost,
    localAlloc,
    researchPerTick,
    speciesBonus,
  );

  const overLimit = otherAllocation + localAlloc > 100;

  const handleApply = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onAdjustAllocation(active.techId, localAlloc);
    },
    [active.techId, localAlloc, onAdjustAllocation],
  );

  const handleCancel = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onCancelResearch(active.techId);
    },
    [active.techId, onCancelResearch],
  );

  return (
    <div
      className={`research-active-item ${isSelected ? 'research-active-item--selected' : ''}`}
      onClick={() => onCardClick(tech)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onCardClick(tech);
      }}
    >
      {/* Name + cancel */}
      <div className="research-active-item__top">
        <span className="research-active-item__name">{tech.name}</span>
        <button
          type="button"
          className="research-active-item__cancel-btn"
          onClick={handleCancel}
          aria-label={`Cancel research on ${tech.name}`}
        >
          &#10005;
        </button>
      </div>

      {/* Progress bar + percentage */}
      <div className="research-active-item__progress-row">
        <div className="research-active-item__progress-track">
          <div
            className="research-active-item__progress-fill"
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </div>
        <span className="research-active-item__progress-pct">
          {Math.floor(progressPercent)}%
        </span>
      </div>

      {/* RP progress + ETA */}
      <div className="research-active-item__bottom">
        <span className="research-active-item__points">
          {Math.floor(active.pointsInvested)} / {tech.cost} RP
        </span>
        <span className="research-active-item__eta">
          {ticks === Infinity ? '— turns' : `~${ticks} turns`}
        </span>
      </div>

      {/* Inline allocation slider */}
      <div
        className="research-active-item__alloc-row"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="research-active-item__alloc-label">Alloc</span>
        <input
          type="range"
          className="research-active-item__alloc-slider"
          min={0}
          max={maxAlloc}
          value={localAlloc}
          onChange={(e) => setLocalAlloc(Number(e.target.value))}
          aria-label={`Allocation for ${tech.name}`}
        />
        <span className={`research-active-item__alloc-val ${overLimit ? 'research-active-item__alloc-val--over' : ''}`}>
          {localAlloc}%
        </span>
        {localAlloc !== active.allocation && (
          <button
            type="button"
            className="research-active-item__apply-btn"
            onClick={handleApply}
            disabled={overLimit}
          >
            Apply
          </button>
        )}
      </div>
    </div>
  );
}

function ActiveResearchList({
  activeResearch,
  techById,
  totalAllocation,
  researchPerTick,
  speciesBonus,
  selectedTechId,
  maxActiveResearch,
  onCardClick,
  onCancelResearch,
  onAdjustAllocation,
}: ActiveResearchListProps): React.ReactElement {
  return (
    <div className="research-active-list">
      <div className="research-active-list__header">
        <span className="research-active-list__title">ACTIVE RESEARCH</span>
        <span className="research-active-list__count">
          {activeResearch.length} / {maxActiveResearch}
        </span>
      </div>

      {activeResearch.length === 0 && (
        <div className="research-active-list__empty">
          No research in progress.<br />
          Click &#9654; Start on any available technology.
        </div>
      )}

      {activeResearch.map((active: ActiveResearch) => {
        const tech = techById.get(active.techId);
        if (!tech) return null;

        const otherAllocation = activeResearch
          .filter((r) => r.techId !== active.techId)
          .reduce((sum, r) => sum + r.allocation, 0);

        return (
          <ActiveResearchItem
            key={active.techId}
            active={active}
            tech={tech}
            researchPerTick={researchPerTick}
            speciesBonus={speciesBonus}
            otherAllocation={otherAllocation}
            isSelected={selectedTechId === active.techId}
            onCardClick={onCardClick}
            onCancelResearch={onCancelResearch}
            onAdjustAllocation={onAdjustAllocation}
          />
        );
      })}

      {/* Total allocation summary */}
      {activeResearch.length > 0 && (
        <div className={`research-active-list__total ${totalAllocation > 100 ? 'research-active-list__total--over' : ''}`}>
          <span>Total Allocation</span>
          <span>{totalAllocation}% / 100%</span>
        </div>
      )}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function ResearchScreen({
  allTechs,
  researchState,
  researchPerTick,
  speciesBonus,
  speciesId,
  onStartResearch,
  onCancelResearch,
  onQueueResearch,
  onDequeueResearch,
  onAdjustAllocation,
  maxActiveResearch: maxActiveResearchProp,
  onClose,
}: ResearchScreenProps): React.ReactElement {
  const maxActive = maxActiveResearchProp ?? MAX_ACTIVE_RESEARCH;
  const [selectedTech, setSelectedTech] = useState<Technology | null>(null);

  // ── Derived data ──────────────────────────────────────────────────────────

  const availableTechs = useMemo(
    () => getAvailableTechs(allTechs, researchState, speciesId),
    [allTechs, researchState, speciesId],
  );

  const availableIds = useMemo(
    () => new Set(availableTechs.map((t) => t.id)),
    [availableTechs],
  );

  const activeIds = useMemo(
    () => new Set(researchState.activeResearch.map((r) => r.techId)),
    [researchState.activeResearch],
  );

  const completedSet = useMemo(
    () => new Set(researchState.completedTechs),
    [researchState.completedTechs],
  );

  const techById = useMemo(
    () => new Map(allTechs.map((t) => [t.id, t])),
    [allTechs],
  );

  const techNamesById = useMemo(
    () => new Map(allTechs.map((t) => [t.id, t.name])),
    [allTechs],
  );

  // Grid: techGrid[category][age] = Technology[]
  const techGrid = useMemo(() => {
    const grid: Record<TechCategory, Record<TechAge, Technology[]>> = {
      weapons:      { nano_atomic: [], fusion: [], nano_fusion: [], anti_matter: [], singularity: [] },
      defense:      { nano_atomic: [], fusion: [], nano_fusion: [], anti_matter: [], singularity: [] },
      propulsion:   { nano_atomic: [], fusion: [], nano_fusion: [], anti_matter: [], singularity: [] },
      biology:      { nano_atomic: [], fusion: [], nano_fusion: [], anti_matter: [], singularity: [] },
      construction: { nano_atomic: [], fusion: [], nano_fusion: [], anti_matter: [], singularity: [] },
      racial:       { nano_atomic: [], fusion: [], nano_fusion: [], anti_matter: [], singularity: [] },
    };
    for (const tech of allTechs) {
      if (grid[tech.category] && grid[tech.category][tech.age]) {
        grid[tech.category][tech.age].push(tech);
      }
    }
    return grid;
  }, [allTechs]);

  // Total allocation across all active research
  const totalAllocation = useMemo(
    () => researchState.activeResearch.reduce((sum, r) => sum + r.allocation, 0),
    [researchState.activeResearch],
  );

  const effectivePointsPerTick = researchPerTick * speciesBonus;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCardClick = useCallback((tech: Technology) => {
    setSelectedTech((prev) => (prev?.id === tech.id ? null : tech));
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedTech(null);
  }, []);

  const handleStartResearch = useCallback((techId: string, allocation: number) => {
    onStartResearch(techId, allocation);
    // Keep panel open to show updated active status
  }, [onStartResearch]);

  const handleCancelResearch = useCallback((techId: string) => {
    onCancelResearch(techId);
    setSelectedTech(null);
  }, [onCancelResearch]);

  // Quick-start: begin research, or queue if all active slots are occupied
  const handleQuickStart = useCallback((tech: Technology) => {
    if (researchState.activeResearch.length < maxActive) {
      // Allocation value is ignored by the engine (auto-split), pass 0 as placeholder
      onStartResearch(tech.id, 0);
    } else if (onQueueResearch) {
      onQueueResearch(tech.id);
    }
  }, [researchState.activeResearch, onStartResearch, onQueueResearch]);

  // ── Render ────────────────────────────────────────────────────────────────

  const currentAgeIndex = ageIndex(researchState.currentAge);

  return (
    <div className="research-screen">
      {/* ── Status Bar ─────────────────────────────────────────────────── */}
      <div className="research-screen__status-bar">
        <div className="research-status-bar__left">
          <div className="research-status-bar__age-label">
            <span className="research-status-bar__age-prefix">CURRENT AGE</span>
            <span className="research-status-bar__age-name">
              {AGE_DISPLAY_NAMES[researchState.currentAge]}
            </span>
          </div>
          <div className="research-status-bar__stat">
            <span className="research-status-bar__stat-label">Research/Turn</span>
            <span className="research-status-bar__stat-value">
              {effectivePointsPerTick.toFixed(1)} RP
            </span>
          </div>
          <div className="research-status-bar__stat">
            <span className="research-status-bar__stat-label">Active Projects</span>
            <span className={`research-status-bar__stat-value ${researchState.activeResearch.length >= maxActive ? 'research-status-bar__stat-value--warn' : ''}`}>
              {researchState.activeResearch.length} / {maxActive}
            </span>
          </div>
          <div className="research-status-bar__stat">
            <span className="research-status-bar__stat-label">Allocation Used</span>
            <span className={`research-status-bar__stat-value ${totalAllocation > 100 ? 'research-status-bar__stat-value--over' : totalAllocation >= 90 ? 'research-status-bar__stat-value--warn' : ''}`}>
              {totalAllocation}%
            </span>
          </div>
        </div>
        <div className="research-status-bar__right">
          <button
            type="button"
            className="research-screen__close-btn"
            onClick={onClose}
          >
            &#10005; Close
          </button>
        </div>
      </div>

      {/* ── Main Layout ─────────────────────────────────────────────────── */}
      <div className="research-screen__main">

        {/* ── Tech Tree Area (Categories as COLUMNS, Ages as ROWS) ── */}
        <div className="research-screen__tree-area">

          {/* Category column headers */}
          <div className="tech-tree__category-headers">
            <div className="tech-tree__age-spacer" />
            {CATEGORIES_ORDERED.map((category) => (
              <div
                key={category}
                className={`tech-tree__category-header tech-tree__category-header--${category}`}
                title={CATEGORY_DESCRIPTIONS[category]}
              >
                <span className="tech-tree__category-header-name">
                  {CATEGORY_DISPLAY_NAMES[category]}
                </span>
              </div>
            ))}
          </div>

          {/* Age rows */}
          <div className="tech-tree__grid tech-tree__grid--age-rows">
            {TECH_AGES_ORDERED.map((age, ageIdx) => {
              const isFutureAge = ageIdx > currentAgeIndex;
              const isCurrentAge = ageIdx === currentAgeIndex;

              return (
                <div key={age} className={`tech-tree__row tech-tree__row--age ${isFutureAge ? 'tech-tree__row--future-age' : ''}`}>
                  {/* Age label */}
                  <div
                    className={`tech-tree__age-label ${isCurrentAge ? 'tech-tree__age-label--current' : ''} ${isFutureAge ? 'tech-tree__age-label--future' : 'tech-tree__age-label--past'}`}
                  >
                    <span className="tech-tree__age-label-name">
                      {AGE_SHORT_NAMES[age]}
                    </span>
                    {isCurrentAge && (
                      <span className="tech-tree__age-label-badge">CURRENT</span>
                    )}
                  </div>

                  {/* Category cells */}
                  {CATEGORIES_ORDERED.map((category) => {
                    const cellTechs = techGrid[category][age];

                    return (
                      <div
                        key={category}
                        className={`tech-tree__cell ${isFutureAge ? 'tech-tree__cell--future-age' : ''}`}
                      >
                        {cellTechs.map((tech) => {
                          const status = getTechStatus(tech, researchState, availableIds, activeIds);
                          const activeEntry = researchState.activeResearch.find(
                            (r) => r.techId === tech.id,
                          );
                          const progressPercent = activeEntry
                            ? (activeEntry.pointsInvested / tech.cost) * 100
                            : 0;

                          return (
                            <TechCard
                              key={tech.id}
                              tech={tech}
                              status={status}
                              progressPercent={progressPercent}
                              onClick={handleCardClick}
                              onStartResearch={handleQuickStart}
                              atCapacity={researchState.activeResearch.length >= maxActive}
                              isSelected={selectedTech?.id === tech.id}
                            />
                          );
                        })}
                        {/* Empty cell placeholder */}
                        {cellTechs.length === 0 && (
                          <div className="tech-tree__cell-empty" />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right Panel ────────────────────────────────────────────── */}
        <div className="research-screen__right-panel">

          {/* Active research list — always at the top */}
          <ActiveResearchList
            activeResearch={researchState.activeResearch}
            techById={techById}
            totalAllocation={totalAllocation}
            researchPerTick={researchPerTick}
            speciesBonus={speciesBonus}
            selectedTechId={selectedTech?.id}
            maxActiveResearch={maxActive}
            onCardClick={handleCardClick}
            onCancelResearch={handleCancelResearch}
            onAdjustAllocation={onAdjustAllocation}
          />

          {/* Research queue */}
          {(researchState.researchQueue ?? []).length > 0 && (
            <div className="research-active-list" style={{ marginTop: '0.5rem' }}>
              <div className="research-active-list__header">
                <span className="research-active-list__title">QUEUED</span>
                <span className="research-active-list__count">
                  {(researchState.researchQueue ?? []).length} queued
                </span>
              </div>
              {(researchState.researchQueue ?? []).map((techId) => {
                const tech = techById.get(techId);
                if (!tech) return null;
                return (
                  <div key={techId} className="research-active-card" style={{ opacity: 0.6 }}>
                    <div className="research-active-card__info">
                      <span className="research-active-card__name">{tech.name}</span>
                      <span className="research-active-card__axis" style={{ fontSize: '0.65rem', color: '#667788' }}>
                        Queued — will start when a slot opens
                      </span>
                    </div>
                    {onDequeueResearch && (
                      <button
                        type="button"
                        className="research-active-card__cancel"
                        onClick={() => onDequeueResearch(techId)}
                        title="Remove from queue"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Detail panel for selected tech — below active list */}
          {selectedTech && (
            <TechDetailPanel
              tech={selectedTech}
              status={getTechStatus(selectedTech, researchState, availableIds, activeIds)}
              researchState={researchState}
              researchPerTick={researchPerTick}
              speciesBonus={speciesBonus}
              completedTechs={completedSet}
              techNamesById={techNamesById}
              allTechs={allTechs}
              onStartResearch={handleStartResearch}
              onCancelResearch={handleCancelResearch}
              onQueueResearch={onQueueResearch}
              onAdjustAllocation={onAdjustAllocation}
              maxActiveResearch={maxActive}
              onClose={handleCloseDetail}
            />
          )}
        </div>
      </div>
    </div>
  );
}
