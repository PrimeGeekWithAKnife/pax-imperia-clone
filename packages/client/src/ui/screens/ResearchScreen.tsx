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
  'diamond_age',
  'spatial_dark_age',
  'neo_renaissance',
  'fusion_age',
  'age_of_star_empires',
];

const AGE_DISPLAY_NAMES: Record<TechAge, string> = {
  diamond_age:         'Diamond Age',
  spatial_dark_age:    'Spatial Dark Age',
  neo_renaissance:     'Neo-Renaissance',
  fusion_age:          'Fusion Age',
  age_of_star_empires: 'Age of Star Empires',
};

const AGE_SHORT_NAMES: Record<TechAge, string> = {
  diamond_age:         'Diamond',
  spatial_dark_age:    'Dark Age',
  neo_renaissance:     'Renaissance',
  fusion_age:          'Fusion',
  age_of_star_empires: 'Star Empires',
};

const CATEGORIES_ORDERED: TechCategory[] = [
  'weapons',
  'defense',
  'propulsion',
  'biology',
  'construction',
  'special',
];

const CATEGORY_DISPLAY_NAMES: Record<TechCategory, string> = {
  weapons:      'Weapons',
  defense:      'Defense',
  propulsion:   'Propulsion',
  biology:      'Biology',
  construction: 'Construction',
  special:      'Special',
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
  onStartResearch: (techId: string, allocation: number) => void;
  onCancelResearch: (techId: string) => void;
  onAdjustAllocation: (techId: string, allocation: number) => void;
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

// ── Component ────────────────────────────────────────────────────────────────

export function ResearchScreen({
  allTechs,
  researchState,
  researchPerTick,
  speciesBonus,
  onStartResearch,
  onCancelResearch,
  onAdjustAllocation,
  onClose,
}: ResearchScreenProps): React.ReactElement {
  const [selectedTech, setSelectedTech] = useState<Technology | null>(null);

  // ── Derived data ──────────────────────────────────────────────────────────

  const availableTechs = useMemo(
    () => getAvailableTechs(allTechs, researchState),
    [allTechs, researchState],
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
      weapons:      { diamond_age: [], spatial_dark_age: [], neo_renaissance: [], fusion_age: [], age_of_star_empires: [] },
      defense:      { diamond_age: [], spatial_dark_age: [], neo_renaissance: [], fusion_age: [], age_of_star_empires: [] },
      propulsion:   { diamond_age: [], spatial_dark_age: [], neo_renaissance: [], fusion_age: [], age_of_star_empires: [] },
      biology:      { diamond_age: [], spatial_dark_age: [], neo_renaissance: [], fusion_age: [], age_of_star_empires: [] },
      construction: { diamond_age: [], spatial_dark_age: [], neo_renaissance: [], fusion_age: [], age_of_star_empires: [] },
      special:      { diamond_age: [], spatial_dark_age: [], neo_renaissance: [], fusion_age: [], age_of_star_empires: [] },
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
            <span className={`research-status-bar__stat-value ${researchState.activeResearch.length >= MAX_ACTIVE_RESEARCH ? 'research-status-bar__stat-value--warn' : ''}`}>
              {researchState.activeResearch.length} / {MAX_ACTIVE_RESEARCH}
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

        {/* ── Tech Tree Area ─────────────────────────────────────────── */}
        <div className="research-screen__tree-area">

          {/* Age column headers */}
          <div className="tech-tree__age-headers">
            <div className="tech-tree__category-spacer" />
            {TECH_AGES_ORDERED.map((age, idx) => (
              <div
                key={age}
                className={`tech-tree__age-header ${idx === currentAgeIndex ? 'tech-tree__age-header--current' : ''} ${idx > currentAgeIndex ? 'tech-tree__age-header--future' : 'tech-tree__age-header--past'}`}
              >
                <span className="tech-tree__age-header-name">{AGE_SHORT_NAMES[age]}</span>
                {idx === currentAgeIndex && (
                  <span className="tech-tree__age-header-badge">CURRENT</span>
                )}
              </div>
            ))}
          </div>

          {/* Category rows */}
          <div className="tech-tree__grid">
            {CATEGORIES_ORDERED.map((category) => (
              <div key={category} className={`tech-tree__row tech-tree__row--${category}`}>
                {/* Category label */}
                <div className="tech-tree__category-label">
                  {CATEGORY_DISPLAY_NAMES[category]}
                </div>

                {/* Age cells */}
                {TECH_AGES_ORDERED.map((age, ageIdx) => {
                  const cellTechs = techGrid[category][age];
                  const isFutureAge = ageIdx > currentAgeIndex;

                  return (
                    <div
                      key={age}
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
            ))}
          </div>
        </div>

        {/* ── Right Panel ────────────────────────────────────────────── */}
        <div className="research-screen__right-panel">

          {/* Detail panel for selected tech */}
          {selectedTech && (
            <TechDetailPanel
              tech={selectedTech}
              status={getTechStatus(selectedTech, researchState, availableIds, activeIds)}
              researchState={researchState}
              researchPerTick={researchPerTick}
              speciesBonus={speciesBonus}
              completedTechs={completedSet}
              techNamesById={techNamesById}
              onStartResearch={handleStartResearch}
              onCancelResearch={handleCancelResearch}
              onAdjustAllocation={onAdjustAllocation}
              onClose={handleCloseDetail}
            />
          )}

          {/* Active research list */}
          <div className="research-active-list">
            <div className="research-active-list__header">
              <span className="research-active-list__title">ACTIVE RESEARCH</span>
              <span className="research-active-list__count">
                {researchState.activeResearch.length} / {MAX_ACTIVE_RESEARCH}
              </span>
            </div>

            {researchState.activeResearch.length === 0 && (
              <div className="research-active-list__empty">
                No research in progress.<br />
                Select an available technology to begin.
              </div>
            )}

            {researchState.activeResearch.map((active: ActiveResearch) => {
              const tech = techById.get(active.techId);
              if (!tech) return null;
              const progressPercent = (active.pointsInvested / tech.cost) * 100;
              const ticks = getResearchSpeed(
                tech.cost - active.pointsInvested,
                active.allocation,
                researchPerTick,
                speciesBonus,
              );

              return (
                <div
                  key={active.techId}
                  className={`research-active-item ${selectedTech?.id === active.techId ? 'research-active-item--selected' : ''}`}
                  onClick={() => handleCardClick(tech)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleCardClick(tech);
                  }}
                >
                  <div className="research-active-item__top">
                    <span className="research-active-item__name">{tech.name}</span>
                    <span className="research-active-item__alloc">{active.allocation}%</span>
                  </div>
                  <div className="research-active-item__progress-track">
                    <div
                      className="research-active-item__progress-fill"
                      style={{ width: `${Math.min(100, progressPercent)}%` }}
                    />
                  </div>
                  <div className="research-active-item__bottom">
                    <span className="research-active-item__points">
                      {Math.floor(active.pointsInvested)} / {tech.cost} RP
                    </span>
                    <span className="research-active-item__eta">
                      {ticks === Infinity ? '— turns' : `~${ticks} turns`}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Total allocation summary */}
            {researchState.activeResearch.length > 0 && (
              <div className={`research-active-list__total ${totalAllocation > 100 ? 'research-active-list__total--over' : ''}`}>
                <span>Total Allocation</span>
                <span>{totalAllocation}% / 100%</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
