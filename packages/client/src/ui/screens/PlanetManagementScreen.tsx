import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { Planet, Building, BuildingType, ShipDesign, HullClass, TechAge } from '@nova-imperia/shared';
import { BUILDING_DEFINITIONS, BUILDING_LEVEL_MULTIPLIER, PLANET_BUILDING_SLOTS, canBuildOnPlanet, HULL_TEMPLATE_BY_CLASS, UNIVERSAL_TECH_BY_ID, getEffectiveMaxPopulation, getPlanetConstructionRate, canUpgradeBuilding, getUpgradeCost, getUpgradeBuildTime, getMaxLevelForAge } from '@nova-imperia/shared';
import { calculateEnergyProduction, calculateEnergyDemand, calculateWasteCapacity, calculateWasteProduction, calculateWasteReduction, getEnergyHappinessModifier } from '@nova-imperia/shared';
import type { EmpireResources } from '@nova-imperia/shared';
import type { TerraformingProgress } from '@nova-imperia/shared';
import { estimateTicksRemaining } from '@nova-imperia/shared';
import type { Governor, GovernorModifiers } from '@nova-imperia/shared';
import { generateCandidatePool } from '@nova-imperia/shared';
import { BuildingSlotGrid } from '../components/BuildingSlotGrid';
import { ResourceBar } from '../components/ResourceBar';
import { ConstructionQueue } from '../components/ConstructionQueue';
import { renderBuildingIcon } from '../../assets/graphics';
import { getAudioEngine, AmbientSounds } from '../../audio';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PLANET_TYPE_LABELS: Record<string, string> = {
  terran: 'Terran',
  ocean: 'Ocean World',
  desert: 'Desert',
  ice: 'Ice World',
  volcanic: 'Volcanic',
  gas_giant: 'Gas Giant',
  barren: 'Barren Rock',
  toxic: 'Toxic World',
};

const PLANET_TYPE_COLORS: Record<string, string> = {
  terran: '#4a9e5c',
  ocean: '#2b7abf',
  desert: '#c9852a',
  ice: '#88ccee',
  volcanic: '#cc4422',
  gas_giant: '#9966cc',
  barren: '#888888',
  toxic: '#6b9e1a',
};

const ATMOSPHERE_LABELS: Record<string, string> = {
  oxygen_nitrogen: 'Oxygen-Nitrogen',
  nitrogen: 'Nitrogen',
  carbon_dioxide: 'Carbon Dioxide',
  methane: 'Methane',
  ammonia: 'Ammonia',
  sulfur_dioxide: 'Sulfur Dioxide',
  hydrogen: 'Hydrogen',
  hydrogen_helium: 'Hydrogen-Helium',
  none: 'None (Vacuum)',
  toxic: 'Toxic',
  vacuum: 'Vacuum',
};

const TERRAFORMING_STAGE_LABELS: Record<string, string> = {
  atmosphere:  'Atmospheric Processing',
  temperature: 'Thermal Regulation',
  biosphere:   'Biosphere Engineering',
  complete:    'Complete',
};

const RESOURCE_ICONS: Record<string, string> = {
  credits: 'CR',
  minerals: 'MN',
  rareElements: 'RE',
  energy: 'EN',
  organics: 'OR',
  exoticMaterials: 'EX',
  faith: 'FT',
  researchPoints: 'RP',
};

const RESOURCE_LABELS: Record<string, string> = {
  credits: 'Credits',
  minerals: 'Minerals',
  rareElements: 'Rare Elements',
  energy: 'Energy',
  organics: 'Organics',
  exoticMaterials: 'Exotic Materials',
  faith: 'Faith',
  researchPoints: 'Research',
};

const ALL_BUILDING_TYPES: BuildingType[] = Object.keys(BUILDING_DEFINITIONS) as BuildingType[];

const ORBITAL_BUILDING_TYPES = new Set<string>([
  'shipyard', 'spaceport', 'orbital_platform', 'orbital_waste_ejector', 'defense_grid',
]);

const GOVERNOR_MOD_LABELS: Record<string, string> = {
  manufacturing:    'Manufacturing',
  research:         'Research',
  energyProduction: 'Energy',
  populationGrowth: 'Pop Growth',
  happiness:        'Happiness',
  construction:     'Construction',
  mining:           'Mining',
  trade:            'Trade',
};

function kelvinToCelsius(k: number): number {
  return Math.round(k - 273.15);
}

function formatPopulation(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function getHabitabilityColor(score: number): string {
  if (score >= 70) return '#4a9e5c';
  if (score >= 40) return '#c9852a';
  return '#cc4422';
}

/** Estimate construction turns from construction point cost using planet's factories. */
function estimateBuildTurns(planet: Planet, constructionCost: number): number {
  // Use a default species construction factor of 1.0 (no species data in this scope)
  const defaultSpecies = { traits: { construction: 5 } } as Parameters<typeof getPlanetConstructionRate>[1];
  const rate = getPlanetConstructionRate(planet, defaultSpecies);
  return rate > 0 ? Math.ceil(constructionCost / rate) : Infinity;
}

/** Rough per-turn production estimate based purely on buildings (no species data in UI layer) */
function estimatePlanetProduction(planet: Planet): Record<string, number> {
  const totals: Record<string, number> = {
    credits: 0,
    minerals: 0,
    rareElements: 0,
    energy: 0,
    organics: 0,
    exoticMaterials: 0,
    faith: 0,
    researchPoints: 0,
  };

  // Base tax estimate: population * 0.5 credits/turn
  totals.credits += planet.currentPopulation * 0.5;

  for (const building of planet.buildings) {
    const def = BUILDING_DEFINITIONS[building.type];
    if (!def) continue;
    const multiplier = Math.pow(BUILDING_LEVEL_MULTIPLIER, building.level - 1);
    for (const [key, val] of Object.entries(def.baseProduction)) {
      if (val !== undefined && key in totals) {
        totals[key] = (totals[key] ?? 0) + val * multiplier;
      }
    }
  }

  return totals;
}

/** Rough per-turn maintenance from buildings */
function estimateMaintenance(planet: Planet): Record<string, number> {
  const totals: Record<string, number> = {
    credits: 0,
    energy: 0,
    organics: 0,
  };

  for (const building of planet.buildings) {
    const def = BUILDING_DEFINITIONS[building.type];
    if (!def) continue;
    for (const [key, val] of Object.entries(def.maintenanceCost)) {
      if (val !== undefined && key in totals) {
        totals[key] = (totals[key] ?? 0) + val;
      }
    }
  }

  return totals;
}

// ── Building Picker Modal ─────────────────────────────────────────────────────

// ── Building category definitions ─────────────────────────────────────────────

type BuildingCategory = 'all' | 'production' | 'population' | 'military' | 'commerce' | 'infrastructure' | 'environment' | 'blueprints';

const BUILDING_CATEGORY_LABELS: Record<BuildingCategory, string> = {
  all: 'All',
  production: 'Production',
  population: 'Population',
  military: 'Military',
  commerce: 'Commerce',
  infrastructure: 'Infrastructure',
  environment: 'Environment',
  blueprints: 'Blueprints',
};

const BUILDING_CATEGORY_MEMBERS: Record<Exclude<BuildingCategory, 'all' | 'blueprints'>, BuildingType[]> = {
  production: ['factory', 'mining_facility', 'power_plant', 'fusion_reactor', 'recycling_plant'] as BuildingType[],
  population: ['population_center', 'hydroponics_bay', 'medical_bay', 'advanced_medical_centre', 'entertainment_complex'] as BuildingType[],
  military: ['shipyard', 'defense_grid', 'military_academy'] as BuildingType[],
  commerce: ['trade_hub', 'spaceport', 'communications_hub'] as BuildingType[],
  infrastructure: ['research_lab', 'orbital_platform', 'terraforming_station', 'energy_storage'] as BuildingType[],
  environment: ['waste_dump', 'waste_incinerator', 'atmosphere_cleanser', 'orbital_waste_ejector'] as BuildingType[],
};

interface BuildingPickerProps {
  planet: Planet;
  empireResources: EmpireResources;
  empireTechs?: string[];
  /** The player's species ID, used to filter racial buildings. */
  playerSpeciesId?: string;
  onSelect: (type: BuildingType) => void;
  onClose: () => void;
}

function BuildingPicker({
  planet,
  empireResources,
  empireTechs,
  playerSpeciesId,
  onSelect,
  onClose,
}: BuildingPickerProps): React.ReactElement {
  const [activeCategory, setActiveCategory] = useState<BuildingCategory>('all');

  // Determine which buildings are locked by unresearched tech
  const isBuildingLockedByTech = (type: BuildingType): boolean => {
    const def = BUILDING_DEFINITIONS[type];
    return !!(def.requiredTech && empireTechs !== undefined && !empireTechs.includes(def.requiredTech));
  };

  // Blueprints tab: show ONLY buildings locked behind tech requirements
  // Normal tabs: show ONLY buildings the player CAN build (hide unresearched)
  const visibleBuildings = ALL_BUILDING_TYPES.filter((type) => {
    const def = BUILDING_DEFINITIONS[type];

    // Hide racial buildings that belong to a different species
    if (def.racialSpeciesId && playerSpeciesId && def.racialSpeciesId !== playerSpeciesId) {
      return false;
    }

    const lockedByTech = isBuildingLockedByTech(type);

    if (activeCategory === 'blueprints') {
      // Blueprints tab: only show buildings locked behind tech
      return lockedByTech;
    }

    // Normal tabs: hide buildings locked behind tech
    if (lockedByTech) return false;

    // Apply category filter
    if (activeCategory !== 'all') {
      const members = BUILDING_CATEGORY_MEMBERS[activeCategory as Exclude<BuildingCategory, 'all' | 'blueprints'>];
      if (!members.includes(type)) return false;
    }

    return true;
  });

  return (
    <div className="bpicker-overlay" onClick={onClose}>
      <div
        className="bpicker"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Choose a building to construct"
      >
        <div className="bpicker__header">
          <span className="bpicker__title">SELECT BUILDING</span>
          <button className="panel-close-btn" onClick={onClose} aria-label="Close building picker">
            ✕
          </button>
        </div>

        {/* Category tabs */}
        <div className="bpicker__tabs" style={{ display: 'flex', gap: '4px', padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          {(Object.keys(BUILDING_CATEGORY_LABELS) as BuildingCategory[]).map((cat) => {
            const isBlueprints = cat === 'blueprints';
            const isActive = activeCategory === cat;
            const activeBg = isBlueprints ? 'rgba(220, 160, 0, 0.3)' : 'rgba(0, 180, 220, 0.3)';
            const activeColor = isBlueprints ? '#f0b020' : '#00d4ff';
            return (
              <button
                key={cat}
                type="button"
                className="bpicker__tab"
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  border: isBlueprints ? '1px solid rgba(220, 160, 0, 0.3)' : 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  background: isActive ? activeBg : 'rgba(255,255,255,0.05)',
                  color: isActive ? activeColor : (isBlueprints ? '#aa8833' : '#8899aa'),
                  fontWeight: isActive ? 'bold' : 'normal',
                  marginLeft: isBlueprints ? 'auto' : undefined,
                }}
                onClick={() => setActiveCategory(cat)}
              >
                {BUILDING_CATEGORY_LABELS[cat]}
              </button>
            );
          })}
        </div>

        <div className="bpicker__list">
          {visibleBuildings.length === 0 ? (
            <div className="bpicker__empty" style={{ padding: '16px', textAlign: 'center', color: '#6688aa', fontFamily: 'monospace', fontSize: '12px' }}>
              {activeCategory === 'blueprints'
                ? 'All buildings researched — nothing left to unlock!'
                : 'No buildings available in this category'}
            </div>
          ) : activeCategory === 'blueprints' ? (
            /* ── Blueprints tab: informational-only, non-clickable ── */
            visibleBuildings.map((type) => {
              const def = BUILDING_DEFINITIONS[type];
              const requiredTechName = def.requiredTech
                ? (UNIVERSAL_TECH_BY_ID[def.requiredTech]?.name ?? def.requiredTech)
                : 'Unknown';
              const iconSrc = renderBuildingIcon(type, 48);

              return (
                <div
                  key={type}
                  className="bpicker-item bpicker-item--blueprint"
                  style={{ opacity: 0.6, cursor: 'default', pointerEvents: 'none' }}
                >
                  <div className="bpicker-item__header">
                    {iconSrc && (
                      <img
                        src={iconSrc}
                        alt=""
                        aria-hidden="true"
                        className="bpicker-item__icon"
                        width={48}
                        height={48}
                        style={{ filter: 'grayscale(100%) brightness(0.7)' }}
                      />
                    )}
                    <span className="bpicker-item__name" style={{ color: '#667788' }}>{getBuildingDisplayName(type)}</span>
                    <span className="bpicker-item__turns" style={{ color: '#556677' }}>~{estimateBuildTurns(planet, def.buildTime)} turns</span>
                  </div>
                  <div style={{ color: '#00cccc', fontSize: '11px', fontFamily: 'monospace', padding: '2px 0 4px 0' }}>
                    Requires: {requiredTechName}
                  </div>
                  <div className="bpicker-item__desc" style={{ color: '#556677' }}>{def.description}</div>
                  <div className="bpicker-item__costs" style={{ opacity: 0.7 }}>
                    {Object.entries(def.baseCost).map(([res, val]) => (
                      <span key={res} className="bpicker-item__cost" style={{ color: '#667788' }}>
                        {RESOURCE_ICONS[res] ?? res}: {val}
                      </span>
                    ))}
                    <span className="bpicker-item__cost" style={{ color: '#667788' }}>
                      EN: {def.energyConsumption}
                    </span>
                    {def.wasteOutput > 0 && (
                      <span className="bpicker-item__cost" style={{ color: '#667788' }}>
                        Waste: {def.wasteOutput}
                      </span>
                    )}
                    {def.happinessImpact !== 0 && (
                      <span className="bpicker-item__cost" style={{ color: def.happinessImpact > 0 ? '#55aa55' : '#aa5555' }}>
                        Happiness: {def.happinessImpact > 0 ? '+' : ''}{def.happinessImpact}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            /* ── Normal tabs: clickable building entries ── */
            visibleBuildings.map((type) => {
              const def = BUILDING_DEFINITIONS[type];

              const check = canBuildOnPlanet(planet, type, undefined, empireTechs);
              const canAffordBuilding = Object.entries(def.baseCost).every(
                ([res, needed]) => (empireResources[res as keyof EmpireResources] ?? 0) >= (needed ?? 0),
              );
              const disabled = !check.allowed || !canAffordBuilding;
              const missingResources = !canAffordBuilding
                ? Object.entries(def.baseCost)
                    .filter(([res, needed]) => (empireResources[res as keyof EmpireResources] ?? 0) < (needed ?? 0))
                    .map(([res, needed]) => {
                      const have = empireResources[res as keyof EmpireResources] ?? 0;
                      return `${res}: need ${needed}, have ${have}`;
                    })
                    .join('; ')
                : '';
              const reason = !check.allowed
                ? check.reason
                : !canAffordBuilding
                  ? `Cannot afford -- ${missingResources}`
                  : undefined;

              const iconSrc = renderBuildingIcon(type, 48);

              const itemClass = `bpicker-item${disabled ? ' bpicker-item--disabled' : ''}`;

              return (
                <button
                  key={type}
                  className={itemClass}
                  onClick={() => !disabled && onSelect(type)}
                  disabled={disabled}
                  title={reason}
                >
                  <div className="bpicker-item__header">
                    {iconSrc && (
                      <img
                        src={iconSrc}
                        alt=""
                        aria-hidden="true"
                        className="bpicker-item__icon"
                        width={48}
                        height={48}
                      />
                    )}
                    <span className="bpicker-item__name">{getBuildingDisplayName(type)}</span>
                    <span className="bpicker-item__turns">~{estimateBuildTurns(planet, def.buildTime)} turns</span>
                  </div>
                  <div className="bpicker-item__desc">{def.description}</div>
                  <div className="bpicker-item__costs">
                    {Object.entries(def.baseCost).map(([res, val]) => (
                      <span
                        key={res}
                        className={`bpicker-item__cost ${
                          (empireResources[res as keyof EmpireResources] ?? 0) < (val ?? 0)
                            ? 'bpicker-item__cost--unaffordable'
                            : ''
                        }`}
                      >
                        {RESOURCE_ICONS[res] ?? res}: {val}
                      </span>
                    ))}
                  </div>
                  {!check.allowed && (
                    <div className="bpicker-item__reason">{check.reason}</div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── UK English overrides for building names ───────────────────────────────────
// The shared constants use American English; override display names here.
const UK_BUILDING_NAME_OVERRIDES: Partial<Record<BuildingType, string>> = {
  defense_grid: 'Defence Grid',
};

function getBuildingDisplayName(type: BuildingType): string {
  return UK_BUILDING_NAME_OVERRIDES[type] ?? BUILDING_DEFINITIONS[type].name;
}

// ── Hull class display helpers ─────────────────────────────────────────────────

const HULL_CLASS_LABELS: Record<HullClass, string> = {
  scout: 'Scout',
  destroyer: 'Destroyer',
  transport: 'Transport',
  cruiser: 'Cruiser',
  carrier: 'Carrier',
  battleship: 'Battleship',
  coloniser: 'Colony Ship',
  dreadnought: 'Dreadnought',
  battle_station: 'Battle Station',
  deep_space_probe: 'Deep Space Probe',
};

const HULL_CLASS_ICONS: Record<HullClass, string> = {
  scout:            '🛸',
  destroyer:        '⚔️',
  transport:        '📦',
  cruiser:          '🚀',
  carrier:          '🛩️',
  battleship:       '💥',
  coloniser:        '🌍',
  dreadnought:      '🔱',
  battle_station:   '🏰',
  deep_space_probe: '📡',
};

function getShipBuildTime(design: ShipDesign): number {
  const hull = HULL_TEMPLATE_BY_CLASS[design.hull];
  if (!hull) return 1;
  return Math.max(1, Math.round(hull.baseCost / 100));
}

function getShipCost(design: ShipDesign): number {
  const hull = HULL_TEMPLATE_BY_CLASS[design.hull];
  return hull?.baseCost ?? 0;
}

// ── Ship Design Picker Modal ───────────────────────────────────────────────────

interface ShipDesignPickerProps {
  designs: ShipDesign[];
  empireResources: EmpireResources;
  onSelect: (design: ShipDesign) => void;
  onClose: () => void;
}

function ShipDesignPicker({
  designs,
  empireResources,
  onSelect,
  onClose,
}: ShipDesignPickerProps): React.ReactElement {
  return (
    <div className="bpicker-overlay" onClick={onClose}>
      <div
        className="bpicker"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Choose a ship design to build"
      >
        <div className="bpicker__header">
          <span className="bpicker__title">SELECT SHIP DESIGN</span>
          <button className="panel-close-btn" onClick={onClose} aria-label="Close ship design picker">
            ✕
          </button>
        </div>

        <div className="bpicker__list">
          {designs.length === 0 ? (
            <div className="bpicker__empty">
              No ship designs — open Ship Designer to create one
            </div>
          ) : (
            designs.map((design) => {
              const cost = getShipCost(design);
              const buildTime = getShipBuildTime(design);
              const canAfford = empireResources.credits >= cost;
              const hull = HULL_TEMPLATE_BY_CLASS[design.hull];
              return (
                <button
                  key={design.id}
                  className={`bpicker-item${!canAfford ? ' bpicker-item--disabled' : ''}`}
                  onClick={() => canAfford && onSelect(design)}
                  disabled={!canAfford}
                  title={!canAfford ? `Cannot afford — need ${cost} CR, have ${Math.floor(empireResources.credits)} CR` : undefined}
                >
                  <div className="bpicker-item__header">
                    <span className="bpicker-item__ship-icon" aria-hidden="true">
                      {HULL_CLASS_ICONS[design.hull] ?? '🚀'}
                    </span>
                    <span className="bpicker-item__name">{design.name}</span>
                    <span className="bpicker-item__turns">{buildTime} turn{buildTime !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="bpicker-item__desc">
                    {HULL_CLASS_LABELS[design.hull] ?? design.hull}
                    {hull ? ` · ${hull.baseHullPoints} HP · Speed ${hull.baseSpeed}` : ''}
                  </div>
                  <div className="bpicker-item__costs">
                    <span
                      className={`bpicker-item__cost ${!canAfford ? 'bpicker-item__cost--unaffordable' : ''}`}
                    >
                      CR: {cost}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

interface PlanetManagementScreenProps {
  planet: Planet;
  /** The star system that contains this planet — required to route build actions. */
  systemId: string;
  empireResources: EmpireResources;
  /** All saved ship designs available for production. */
  savedDesigns: ShipDesign[];
  /** Terraforming progress for this planet, if active. */
  terraformingProgress?: TerraformingProgress | null;
  /** Researched technology IDs — used to gate building availability. */
  empireTechs?: string[];
  /** Currently assigned governor for this planet, if any. */
  governor?: Governor | null;
  /** Called when the player appoints a new governor. */
  onAppointGovernor?: (planetId: string, governor: Governor) => void;
  /** All colonised planets owned by the player — used for left/right navigation. */
  allColonisedPlanets?: Array<{ planet: Planet; systemId: string }>;
  /** Called when the player navigates to a different planet via the arrows. */
  onChangePlanet?: (planet: Planet, systemId: string) => void;
  /** The player's species ID — used to filter racial buildings in the picker. */
  playerSpeciesId?: string;
  onClose: () => void;
  onBuild: (planetId: string, buildingType: BuildingType) => void;
  onCancelQueue: (planetId: string, queueIndex: number) => void;
  onProduceShip: (planetId: string, design: ShipDesign) => void;
  /** Called when the player confirms demolition of a building. */
  onDemolish?: (planetId: string, buildingId: string) => void;
  /** Called when the player upgrades a building. */
  onUpgrade?: (planetId: string, buildingId: string) => void;
  /** The player empire's current technology age — gates upgrade levels. */
  currentAge?: TechAge;
}

export function PlanetManagementScreen({
  planet,
  systemId: _systemId,
  empireResources,
  savedDesigns,
  terraformingProgress = null,
  empireTechs,
  governor = null,
  onAppointGovernor,
  allColonisedPlanets = [],
  onChangePlanet,
  playerSpeciesId,
  onClose,
  onBuild,
  onCancelQueue,
  onProduceShip,
  onDemolish,
  onUpgrade,
  currentAge = 'nano_atomic',
}: PlanetManagementScreenProps): React.ReactElement {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [shipPickerOpen, setShipPickerOpen] = useState(false);
  const [governorModalOpen, setGovernorModalOpen] = useState(false);
  const [candidates, setCandidates] = useState<Governor[]>([]);
  const [candidatesGeneration, setCandidatesGeneration] = useState(0);
  const [demolishTarget, setDemolishTarget] = useState<Building | null>(null);

  // ── Ambient sound management ─────────────────────────────────────────────────
  const ambientRef = useRef<AmbientSounds | null>(null);

  // Start planet surface ambient when the screen mounts; stop on unmount.
  useEffect(() => {
    const audioEngine = getAudioEngine();
    if (!audioEngine) return;

    if (!ambientRef.current) {
      ambientRef.current = new AmbientSounds(audioEngine);
    }

    const ambient = ambientRef.current;
    ambient.startPlanetAmbient(planet.type, planet.buildings.length);

    return () => {
      ambient.stopAllAmbients();
    };
  // Re-run only when the planet type changes (navigating between planets).
  }, [planet.type]);

  // Start shipyard ambient when the shipyard section becomes visible.
  // Check whether the planet has a shipyard (also used by the render below).
  const hasShipyard = planet.buildings.some(b => b.type === 'shipyard');

  // Switch to shipyard ambient when the planet has a shipyard; revert when not.
  useEffect(() => {
    const ambient = ambientRef.current;
    if (!ambient) return;
    if (hasShipyard) {
      ambient.startShipyardAmbient();
    } else {
      ambient.stopShipyardAmbient();
    }
  }, [hasShipyard]);

  // ── Planet navigation (left/right arrows) ─────────────────────────────────
  const sortedPlanets = [...allColonisedPlanets].sort((a, b) =>
    a.planet.name.localeCompare(b.planet.name),
  );
  const currentPlanetIdx = sortedPlanets.findIndex((p) => p.planet.id === planet.id);
  const hasPrev = sortedPlanets.length > 1;
  const hasNext = sortedPlanets.length > 1;

  const handlePrevPlanet = useCallback(() => {
    if (sortedPlanets.length <= 1 || currentPlanetIdx < 0) return;
    const prevIdx = (currentPlanetIdx - 1 + sortedPlanets.length) % sortedPlanets.length;
    const prev = sortedPlanets[prevIdx];
    if (prev && onChangePlanet) onChangePlanet(prev.planet, prev.systemId);
  }, [sortedPlanets, currentPlanetIdx, onChangePlanet]);

  const handleNextPlanet = useCallback(() => {
    if (sortedPlanets.length <= 1 || currentPlanetIdx < 0) return;
    const nextIdx = (currentPlanetIdx + 1) % sortedPlanets.length;
    const next = sortedPlanets[nextIdx];
    if (next && onChangePlanet) onChangePlanet(next.planet, next.systemId);
  }, [sortedPlanets, currentPlanetIdx, onChangePlanet]);

  const totalSlots = PLANET_BUILDING_SLOTS[planet.type];
  const usedSlots = planet.buildings.length;

  const production = estimatePlanetProduction(planet);
  const maintenance = estimateMaintenance(planet);

  // Terraforming state
  const terraformingStation = planet.buildings.find(b => b.type === 'terraforming_station');
  const stationLevel = terraformingStation?.level ?? 1;
  const activeTerraforming = terraformingProgress && terraformingProgress.stage !== 'complete'
    ? terraformingProgress
    : null;
  const turnsToCompletion = activeTerraforming
    ? estimateTicksRemaining(activeTerraforming, stationLevel)
    : null;

  const handleEmptySlotClick = useCallback(() => {
    setPickerOpen(true);
  }, []);

  const [upgradeTarget, setUpgradeTarget] = useState<Building | null>(null);
  const [activeTab, setActiveTab] = useState<'build-queue' | 'population' | 'economy' | 'orbitals'>('economy');

  const handleBuildingClick = useCallback((building: Building, _index: number) => {
    setUpgradeTarget(prev => (prev?.id === building.id ? null : building));
  }, []);

  const handleConfirmUpgrade = useCallback(() => {
    if (!upgradeTarget || !onUpgrade) return;
    onUpgrade(planet.id, upgradeTarget.id);
    setUpgradeTarget(null);
  }, [upgradeTarget, onUpgrade, planet.id]);

  const handleSelectBuilding = useCallback(
    (type: BuildingType) => {
      setPickerOpen(false);
      onBuild(planet.id, type);
    },
    [planet.id, onBuild],
  );

  const handleCancelQueue = useCallback(
    (index: number) => {
      onCancelQueue(planet.id, index);
    },
    [planet.id, onCancelQueue],
  );

  const handleSelectShipDesign = useCallback(
    (design: ShipDesign) => {
      setShipPickerOpen(false);
      onProduceShip(planet.id, design);
    },
    [planet.id, onProduceShip],
  );

  // Governor handlers
  const handleOpenGovernorModal = useCallback(() => {
    const pool = generateCandidatePool(planet.ownerId ?? '', planet.id, 5);
    setCandidates(pool);
    setGovernorModalOpen(true);
  }, [planet.id, planet.ownerId]);

  const handleRefreshCandidates = useCallback(() => {
    const pool = generateCandidatePool(planet.ownerId ?? '', planet.id, 5);
    setCandidates(pool);
    setCandidatesGeneration(g => g + 1);
  }, [planet.id, planet.ownerId]);

  const handleAppointCandidate = useCallback(
    (candidate: Governor) => {
      setGovernorModalOpen(false);
      if (onAppointGovernor) {
        onAppointGovernor(planet.id, { ...candidate, planetId: planet.id, empireId: planet.ownerId ?? '' });
      }
    },
    [planet.id, planet.ownerId, onAppointGovernor],
  );

  // ── Demolish handlers ──────────────────────────────────────────────────────
  const handleDemolishRequest = useCallback((building: Building) => {
    setDemolishTarget(building);
  }, []);

  const handleDemolishConfirm = useCallback(() => {
    if (demolishTarget && onDemolish) {
      onDemolish(planet.id, demolishTarget.id);
    }
    setDemolishTarget(null);
  }, [demolishTarget, onDemolish, planet.id]);

  const handleDemolishCancel = useCallback(() => {
    setDemolishTarget(null);
  }, []);

  // Ship production queue entries (type === 'ship')
  const shipQueue = planet.productionQueue.filter(item => item.type === 'ship');

  // Rough habitability score — show as natural resources proxy since we don't
  // have species here; use a simplified 0–100 bar based on temp + gravity heuristic.
  const habitabilityEstimate = Math.round(
    Math.min(100,
      (planet.naturalResources * 0.4) +
      Math.max(0, 40 - Math.abs(planet.gravity - 1.0) * 40) +
      Math.max(0, 30 - Math.abs(planet.temperature - 288) * 0.1),
    ),
  );
  const habitabilityColor = getHabitabilityColor(habitabilityEstimate);

  const planetColor = PLANET_TYPE_COLORS[planet.type] ?? '#888888';

  // Net production = production - maintenance (for keys that overlap)
  const netProduction: Record<string, number> = { ...production };
  for (const [key, val] of Object.entries(maintenance)) {
    netProduction[key] = (netProduction[key] ?? 0) - val;
  }

  const RESOURCE_KEYS = ['credits', 'minerals', 'rareElements', 'energy', 'organics', 'exoticMaterials', 'faith', 'researchPoints'] as const;

  return (
    <div className="pm-overlay">
      <div className="pm-screen">

        {/* ── Header ── */}
        <div className="pm-header">
          <div
            className="pm-header__planet-icon"
            style={{ background: planetColor }}
            aria-hidden="true"
          />
          {hasPrev && (
            <button
              type="button"
              className="pm-header__nav-arrow pm-header__nav-arrow--left"
              onClick={handlePrevPlanet}
              aria-label="Previous planet"
              style={{
                background: 'none',
                border: 'none',
                color: '#6688aa',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '0 6px',
                lineHeight: 1,
              }}
            >
              &#9664;
            </button>
          )}
          <div className="pm-header__info">
            <h2 className="pm-header__name">{planet.name}</h2>
            <div className="pm-header__type">
              {PLANET_TYPE_LABELS[planet.type] ?? planet.type}
            </div>
          </div>
          {hasNext && (
            <button
              type="button"
              className="pm-header__nav-arrow pm-header__nav-arrow--right"
              onClick={handleNextPlanet}
              aria-label="Next planet"
              style={{
                background: 'none',
                border: 'none',
                color: '#6688aa',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '0 6px',
                lineHeight: 1,
              }}
            >
              &#9654;
            </button>
          )}
          {planet.ownerId && (
            <div className="pm-header__owner">
              OWNED
            </div>
          )}
          <button
            className="panel-close-btn pm-header__close"
            onClick={onClose}
            aria-label="Close planet management"
          >
            ✕
          </button>
        </div>

        {/* ── Body: three columns ── */}
        <div className="pm-body">

          {/* Left column: Planet info */}
          <div className="pm-col pm-col--info">

            {/* ── Governor section ── */}
            <div className="pm-section-label">GOVERNOR</div>
            {governor ? (
              <div className="pm-governor">
                <div className="pm-governor__name">{governor.name}</div>
                <div className="pm-governor__trait">{governor.trait}</div>

                {/* Age progress bar */}
                {(() => {
                  const pct = Math.min(100, Math.round((governor.turnsServed / governor.lifespan) * 100));
                  const barColor = pct >= 75 ? '#cc4422' : pct >= 50 ? '#c9852a' : '#4a9e5c';
                  return (
                    <div className="pm-governor__age-row">
                      <span className="pm-stat-label">Served</span>
                      <span className="pm-stat-value pm-stat-value--muted">
                        {governor.turnsServed}/{governor.lifespan} turns
                      </span>
                      <div className="pm-governor__age-track">
                        <div
                          className="pm-governor__age-fill"
                          style={{ width: `${pct}%`, background: barColor }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* Modifiers list */}
                <div className="pm-governor__modifiers">
                  {(Object.entries(governor.modifiers) as [keyof GovernorModifiers, number][]).map(([key, val]) => (
                    <div key={key} className="pm-governor__mod-row">
                      <span className="pm-governor__mod-label">{GOVERNOR_MOD_LABELS[key] ?? key}</span>
                      <span
                        className="pm-governor__mod-value"
                        style={{ color: val >= 0 ? '#4a9e5c' : '#cc4422' }}
                      >
                        {val >= 0 ? '+' : ''}{val}%
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  className="pm-governor__replace-btn"
                  onClick={handleOpenGovernorModal}
                >
                  Replace Governor
                </button>
              </div>
            ) : (
              <div className="pm-governor pm-governor--vacancy">
                <div className="pm-governor__vacancy-label">VACANCY</div>
                <div className="pm-governor__vacancy-hint">Select a new governor</div>
                <button
                  className="pm-governor__replace-btn"
                  onClick={handleOpenGovernorModal}
                >
                  Appoint Governor
                </button>
              </div>
            )}

            <div className="pm-divider" />

            <div className="pm-section-label">PLANET INFO</div>

            {/* Visual representation */}
            <div className="pm-planet-visual">
              <div
                className="pm-planet-circle"
                style={{ background: `radial-gradient(circle at 35% 35%, ${planetColor}cc, ${planetColor}55 60%, #111 100%)` }}
                aria-hidden="true"
              />
            </div>

            <div className="pm-stat-group">
              <div className="panel-section-label">ENVIRONMENT</div>
              <div className="pm-stat-row">
                <span className="pm-stat-label">Type</span>
                <span className="pm-stat-value">{PLANET_TYPE_LABELS[planet.type] ?? planet.type}</span>
              </div>
              <div className="pm-stat-row">
                <span className="pm-stat-label">Atmosphere</span>
                <span className="pm-stat-value">{ATMOSPHERE_LABELS[planet.atmosphere] ?? planet.atmosphere}</span>
              </div>
              <div className="pm-stat-row">
                <span className="pm-stat-label">Gravity</span>
                <span className="pm-stat-value">{planet.gravity.toFixed(2)}g</span>
              </div>
              <div className="pm-stat-row">
                <span className="pm-stat-label">Temperature</span>
                <span className="pm-stat-value">
                  {planet.temperature}K
                  <span className="pm-stat-value--muted"> ({kelvinToCelsius(planet.temperature)}°C)</span>
                </span>
              </div>
            </div>

            <div className="pm-stat-group">
              <div className="panel-section-label">HABITABILITY</div>
              <div className="pm-hab-bar-track">
                <div
                  className="pm-hab-bar-fill"
                  style={{ width: `${habitabilityEstimate}%`, background: habitabilityColor }}
                />
                <span className="pm-hab-bar-label" style={{ color: habitabilityColor }}>
                  {habitabilityEstimate}/100
                </span>
              </div>
            </div>

            <div className="pm-stat-group">
              <div className="panel-section-label">POPULATION</div>
              <div className="pm-stat-row">
                <span className="pm-stat-label">Current</span>
                <span className="pm-stat-value">
                  {planet.currentPopulation > 0
                    ? formatPopulation(planet.currentPopulation)
                    : <span className="pm-stat-value--muted">None</span>}
                </span>
              </div>
              <div className="pm-stat-row">
                <span className="pm-stat-label">Capacity</span>
                <span className="pm-stat-value">{formatPopulation(getEffectiveMaxPopulation(planet))}</span>
              </div>
              {planet.currentPopulation > 0 && planet.currentPopulation < getEffectiveMaxPopulation(planet) && (
                <div className="pm-stat-row">
                  <span className="pm-stat-label">Growth</span>
                  <span className="pm-stat-value pm-stat-value--positive">Growing</span>
                </div>
              )}
            </div>

            {/* Food (organics) production vs consumption for this planet */}
            {planet.currentPopulation > 0 && (
              <div className="pm-stat-group">
                <div className="panel-section-label">FOOD (ORGANICS)</div>
                <div className="pm-stat-row">
                  <span className="pm-stat-label">Production</span>
                  <span className="pm-stat-value pm-stat-value--positive">
                    +{Math.round((production.organics ?? 0) * 10) / 10}
                  </span>
                </div>
                <div className="pm-stat-row">
                  <span className="pm-stat-label">Consumption</span>
                  <span className="pm-stat-value" style={{ color: '#ff8844' }}>
                    -{Math.round(planet.currentPopulation / 50_000 * 10) / 10}
                  </span>
                </div>
                {(() => {
                  const foodNet = (production.organics ?? 0) - planet.currentPopulation / 50_000;
                  const isDeficit = foodNet < 0;
                  return (
                    <div className="pm-stat-row">
                      <span className="pm-stat-label">Net</span>
                      <span
                        className="pm-stat-value"
                        style={{ color: isDeficit ? '#ff4444' : '#44cc88', fontWeight: 'bold' }}
                      >
                        {foodNet >= 0 ? '+' : ''}{Math.round(foodNet * 10) / 10}
                        {isDeficit && ' (STARVATION)'}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ── Energy / Waste / Happiness indicators ── */}
            {planet.currentPopulation > 0 && (() => {
              const energyProd = calculateEnergyProduction(planet.buildings);
              const energyDem = calculateEnergyDemand(planet.buildings);
              const energySurplus = energyProd >= energyDem;
              const energyColor = energySurplus ? '#4a9e5c' : '#cc4422';

              const wasteCapacity = calculateWasteCapacity(planet.type);
              const grossWaste = calculateWasteProduction(planet.buildings, planet.currentPopulation);
              const wasteReduction = calculateWasteReduction(planet.buildings, grossWaste);
              const netWaste = Math.max(0, grossWaste - wasteReduction);
              // Estimate current waste as net waste (per-tick approximation)
              const wasteRatio = wasteCapacity > 0 ? netWaste / wasteCapacity : 0;
              const wasteColor = wasteRatio < 0.5 ? '#4a9e5c' : wasteRatio < 0.8 ? '#c9852a' : '#cc4422';

              const energyRatio = energyDem > 0 ? energyProd / energyDem : (energyProd > 0 ? 10 : 1);
              const happinessMod = getEnergyHappinessModifier(energyRatio);
              // Waste overflow penalty — roughly -1 per 10% over capacity
              const wasteOverflowPenalty = wasteRatio > 1 ? -Math.floor((wasteRatio - 1) * 10) : 0;
              const happinessScore = 50 + happinessMod + wasteOverflowPenalty;
              const happinessLabel = happinessScore >= 60 ? 'Content' : happinessScore >= 40 ? 'Discontent' : 'Unrest';
              const happinessColor = happinessScore >= 60 ? '#4a9e5c' : happinessScore >= 40 ? '#c9852a' : '#cc4422';

              return (
                <div className="pm-stat-group">
                  <div className="panel-section-label">STATUS INDICATORS</div>
                  <div className="pm-indicators">
                    <div className="pm-indicator-row">
                      <span className="pm-indicator-label">Energy</span>
                      <span className="pm-indicator-value" style={{ color: energyColor }}>
                        {Math.round(energyProd)}/{Math.round(energyDem)}
                      </span>
                    </div>
                    <div className="pm-indicator-row">
                      <span className="pm-indicator-label">Waste</span>
                      <span className="pm-indicator-value" style={{ color: wasteColor }}>
                        {Math.round(netWaste * 10) / 10}/{wasteCapacity > 0 ? wasteCapacity.toLocaleString() : '--'}
                      </span>
                    </div>
                    <div className="pm-indicator-row">
                      <span className="pm-indicator-label">Morale</span>
                      <span className="pm-indicator-value" style={{ color: happinessColor }}>
                        {happinessLabel} ({happinessScore})
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="pm-stat-group">
              <div className="panel-section-label">NATURAL RESOURCES</div>
              <div className="pm-res-rating-track">
                <div
                  className="pm-res-rating-fill"
                  style={{ width: `${planet.naturalResources}%` }}
                />
                <span className="pm-res-rating-label">{planet.naturalResources}/100</span>
              </div>
            </div>

            {/* Terraforming progress section — only shown when active */}
            {activeTerraforming && (
              <div className="pm-stat-group pm-terraforming">
                <div className="panel-section-label">TERRAFORMING</div>

                <div className="pm-stat-row">
                  <span className="pm-stat-label">Stage</span>
                  <span className="pm-stat-value pm-stat-value--terraforming">
                    {TERRAFORMING_STAGE_LABELS[activeTerraforming.stage]}
                  </span>
                </div>

                <div className="pm-stat-row">
                  <span className="pm-stat-label">Stage progress</span>
                </div>
                <div className="pm-res-rating-track">
                  <div
                    className="pm-res-rating-fill pm-terraforming__stage-fill"
                    style={{ width: `${Math.floor(activeTerraforming.progress)}%` }}
                  />
                  <span className="pm-res-rating-label">
                    {Math.floor(activeTerraforming.progress)}/100
                  </span>
                </div>

                {activeTerraforming.targetType && (
                  <div className="pm-stat-row">
                    <span className="pm-stat-label">Target type</span>
                    <span className="pm-stat-value">
                      {PLANET_TYPE_LABELS[activeTerraforming.targetType] ?? activeTerraforming.targetType}
                    </span>
                  </div>
                )}

                {turnsToCompletion !== null && (
                  <div className="pm-stat-row">
                    <span className="pm-stat-label">Est. completion</span>
                    <span className="pm-stat-value pm-stat-value--muted">
                      {turnsToCompletion.toLocaleString()} turns
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Show a hint when a station is built but the planet can't be terraformed */}
            {terraformingStation && !activeTerraforming && (
              <div className="pm-stat-group pm-terraforming">
                <div className="panel-section-label">TERRAFORMING</div>
                <div className="pm-prod-empty">
                  {planet.type === 'terran'
                    ? 'Planet is already terran — no further terraforming needed'
                    : 'Terraforming complete'}
                </div>
              </div>
            )}
          </div>

          {/* Center column: Shipyard (if present) + Building slots + queue */}
          <div className="pm-col pm-col--buildings">
            {hasShipyard && (
              <>
                <div className="pm-section-label">SHIPYARD</div>
                <div className="pm-shipyard">
                  <button
                    className="pm-shipyard__build-btn"
                    onClick={() => setShipPickerOpen(true)}
                  >
                    Build Ship
                  </button>
                  {shipQueue.length > 0 ? (
                    <div className="pm-shipyard__queue">
                      {shipQueue.map((item, idx) => {
                        // Look up the design name from savedDesigns; fall back
                        // to showing the design ID prefix.
                        const design = savedDesigns.find(d => d.id === item.templateId);
                        const hull = design ? HULL_TEMPLATE_BY_CLASS[design.hull] : null;
                        const totalTurns = hull ? Math.max(1, Math.round(hull.baseCost / 100)) : item.turnsRemaining;
                        const elapsed = Math.max(0, totalTurns - item.turnsRemaining);
                        const progressPct = Math.min(100, Math.round((elapsed / totalTurns) * 100));
                        return (
                          <div key={idx} className="pm-shipyard__queue-item">
                            <span className="pm-shipyard__queue-name">
                              {design
                                ? `${HULL_CLASS_ICONS[design.hull] ?? '🚀'} ${design.name}`
                                : `🚀 Ship (${item.templateId.slice(0, 8)}…)`}
                            </span>
                            <div className="pm-shipyard__progress-track">
                              <div
                                className="pm-shipyard__progress-fill"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                            <span className="pm-shipyard__turns-left">
                              {item.turnsRemaining} turn{item.turnsRemaining !== 1 ? 's' : ''} remaining
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="pm-shipyard__idle">No ships in production</div>
                  )}
                </div>
                <div className="pm-divider" />
              </>
            )}

            <div className="pm-section-label">
              BUILDING SLOTS
              <span className="pm-section-label__count">{usedSlots}/{totalSlots}</span>
            </div>

            <BuildingSlotGrid
              totalSlots={totalSlots}
              buildings={planet.buildings}
              onEmptySlotClick={handleEmptySlotClick}
              onBuildingClick={handleBuildingClick}
              onDemolish={onDemolish ? handleDemolishRequest : undefined}
            />

            {upgradeTarget && (() => {
              const def = BUILDING_DEFINITIONS[upgradeTarget.type];
              const check = canUpgradeBuilding(planet, upgradeTarget.id, currentAge);
              const cost = getUpgradeCost(upgradeTarget.type, upgradeTarget.level);
              const buildTime = getUpgradeBuildTime(upgradeTarget.type, upgradeTarget.level);
              const isMaxLevel = upgradeTarget.level >= def.maxLevel;
              const ageCap = getMaxLevelForAge(upgradeTarget.type, currentAge);
              const isAgeCapped = upgradeTarget.level >= ageCap && !isMaxLevel;
              const canAfford = Object.entries(cost).every(([key, amount]) =>
                (empireResources[key as keyof EmpireResources] ?? 0) >= (amount ?? 0),
              );

              return (
                <div className="upgrade-popover">
                  <div className="upgrade-popover__header">
                    <span className="upgrade-popover__name">{def.name}</span>
                    <span className="upgrade-popover__level">
                      Lv.{upgradeTarget.level}
                      {isMaxLevel ? ' (MAX)' : isAgeCapped ? ` / ${ageCap} (age limit)` : ` → ${upgradeTarget.level + 1}`}
                    </span>
                    <button
                      type="button"
                      className="upgrade-popover__close panel-close-btn"
                      onClick={() => setUpgradeTarget(null)}
                    >
                      ✕
                    </button>
                  </div>

                  <p className="upgrade-popover__desc">{def.description}</p>

                  {/* Current building stats at this level */}
                  <div className="upgrade-popover__stats">
                    <span className="upgrade-popover__stats-label">Output at Lv.{upgradeTarget.level}:</span>
                    {(() => {
                      const lvlMult = Math.pow(BUILDING_LEVEL_MULTIPLIER, upgradeTarget.level - 1);
                      const entries: Array<{ label: string; value: string; positive: boolean }> = [];

                      for (const [key, base] of Object.entries(def.baseProduction)) {
                        if (base && base > 0) {
                          const scaled = Math.round(base * lvlMult * 10) / 10;
                          entries.push({ label: RESOURCE_LABELS[key] ?? key, value: `+${scaled}`, positive: true });
                        }
                      }

                      if (def.energyConsumption > 0) {
                        const scaled = Math.round(def.energyConsumption * lvlMult * 10) / 10;
                        entries.push({ label: 'Energy draw', value: `-${scaled}`, positive: false });
                      }

                      if (def.wasteOutput > 0) {
                        const scaled = Math.round(def.wasteOutput * lvlMult * 10) / 10;
                        entries.push({ label: 'Waste', value: `+${scaled}`, positive: false });
                      }

                      for (const [key, base] of Object.entries(def.maintenanceCost)) {
                        if (base && base > 0) {
                          entries.push({ label: `${RESOURCE_LABELS[key] ?? key} maint.`, value: `-${base}`, positive: false });
                        }
                      }

                      if (def.happinessImpact !== 0) {
                        entries.push({
                          label: 'Happiness',
                          value: `${def.happinessImpact > 0 ? '+' : ''}${def.happinessImpact}`,
                          positive: def.happinessImpact > 0,
                        });
                      }

                      if (entries.length === 0) return null;

                      return entries.map((e, i) => (
                        <span key={i} className={`upgrade-popover__stat ${e.positive ? '' : 'upgrade-popover__stat--negative'}`}>
                          {e.label}: {e.value}
                        </span>
                      ));
                    })()}
                  </div>

                  {!isMaxLevel && !isAgeCapped && (
                    <>
                      <div className="upgrade-popover__costs">
                        <span className="upgrade-popover__label">Upgrade cost:</span>
                        {Object.entries(cost).map(([key, amount]) => (
                          <span
                            key={key}
                            className={`upgrade-popover__cost ${
                              (empireResources[key as keyof EmpireResources] ?? 0) < (amount ?? 0)
                                ? 'upgrade-popover__cost--unaffordable'
                                : ''
                            }`}
                          >
                            {RESOURCE_ICONS[key] ?? key}: {amount}
                          </span>
                        ))}
                      </div>
                      <div className="upgrade-popover__time">
                        Build time: {buildTime} construction points
                      </div>
                    </>
                  )}

                  {isAgeCapped && (
                    <div className="upgrade-popover__reason">
                      Advance to the next technology age to unlock further upgrades.
                    </div>
                  )}

                  {!isMaxLevel && !isAgeCapped && (
                    <button
                      type="button"
                      className="sc-btn sc-btn--primary upgrade-popover__btn"
                      disabled={!check.allowed || !canAfford}
                      onClick={handleConfirmUpgrade}
                      title={!check.allowed ? check.reason : !canAfford ? 'Insufficient resources' : `Upgrade to Lv.${upgradeTarget.level + 1}`}
                    >
                      Upgrade to Lv.{upgradeTarget.level + 1}
                    </button>
                  )}
                </div>
              );
            })()}

          </div>

          {/* Right column: Tabbed panels */}
          <div className="pm-col pm-col--production">
            {/* Tab strip */}
            <div className="pm-tabs" role="tablist">
              {([
                ['build-queue', 'Build Queue'],
                ['population', 'Population'],
                ['economy', 'Economy'],
                ['orbitals', 'Orbitals'],
              ] as Array<['build-queue' | 'population' | 'economy' | 'orbitals', string]>).map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={activeTab === key}
                  className={`pm-tab ${activeTab === key ? 'pm-tab--active' : ''}`}
                  onClick={() => setActiveTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="pm-tab-content">
              {/* ── Economy tab ── */}
              {activeTab === 'economy' && (
                <>
                  <div className="pm-section-label">PRODUCTION / TURN</div>
                  <div className="pm-prod-group">
                    {RESOURCE_KEYS.map((key) => {
                      const val = production[key] ?? 0;
                      if (val === 0) return null;
                      return (
                        <ResourceBar
                          key={key}
                          label={RESOURCE_LABELS[key] ?? key}
                          icon={RESOURCE_ICONS[key] ?? '?'}
                          value={val}
                          showSign
                        />
                      );
                    })}
                  </div>

                  <div className="pm-divider" />
                  <div className="pm-section-label">MAINTENANCE</div>
                  <div className="pm-prod-group">
                    {Object.entries(maintenance).map(([key, val]) => {
                      if (val === 0) return null;
                      return (
                        <ResourceBar
                          key={key}
                          label={RESOURCE_LABELS[key] ?? key}
                          icon={RESOURCE_ICONS[key] ?? '?'}
                          value={-val}
                          showSign
                        />
                      );
                    })}
                    {Object.values(maintenance).every((v) => v === 0) && (
                      <div className="pm-prod-empty">No maintenance costs</div>
                    )}
                  </div>

                  <div className="pm-divider" />
                  <div className="pm-section-label">NET OUTPUT</div>
                  <div className="pm-prod-group pm-prod-group--net">
                    {RESOURCE_KEYS.map((key) => {
                      const net = netProduction[key] ?? 0;
                      if (net === 0) return null;
                      return (
                        <ResourceBar
                          key={key}
                          label={RESOURCE_LABELS[key] ?? key}
                          icon={RESOURCE_ICONS[key] ?? '?'}
                          value={net}
                          showSign
                        />
                      );
                    })}
                    {RESOURCE_KEYS.every((k) => (netProduction[k] ?? 0) === 0) && (
                      <div className="pm-prod-empty">No output — build something</div>
                    )}
                  </div>
                </>
              )}

              {/* ── Build Queue tab ── */}
              {activeTab === 'build-queue' && (
                <>
                  {planet.productionQueue.length === 0 ? (
                    <div className="pm-prod-empty">No items in production</div>
                  ) : (
                    <>
                      {planet.productionQueue.some(q => q.type === 'building' || q.type === 'building_upgrade') && (
                        <>
                          <div className="pm-section-label">BUILDINGS</div>
                          <ConstructionQueue
                            queue={planet.productionQueue.filter(q => q.type === 'building' || q.type === 'building_upgrade')}
                            onCancel={(idx) => {
                              const filtered = planet.productionQueue.filter(q => q.type === 'building' || q.type === 'building_upgrade');
                              const origIdx = planet.productionQueue.indexOf(filtered[idx]!);
                              if (origIdx >= 0) handleCancelQueue(origIdx);
                            }}
                            buildings={planet.buildings}
                          />
                        </>
                      )}
                      {planet.productionQueue.some(q => q.type === 'ship') && (
                        <>
                          <div className="pm-section-label">SHIPS</div>
                          <ConstructionQueue
                            queue={planet.productionQueue.filter(q => q.type === 'ship')}
                            onCancel={(idx) => {
                              const filtered = planet.productionQueue.filter(q => q.type === 'ship');
                              const origIdx = planet.productionQueue.indexOf(filtered[idx]!);
                              if (origIdx >= 0) handleCancelQueue(origIdx);
                            }}
                          />
                        </>
                      )}
                    </>
                  )}
                </>
              )}

              {/* ── Population tab ── */}
              {activeTab === 'population' && (
                <>
                  <div className="pm-section-label">POPULATION</div>
                  <div className="pm-prod-group">
                    <div className="pm-stat-row">
                      <span className="pm-stat-label">Current</span>
                      <span className="pm-stat-value">{planet.currentPopulation.toLocaleString()}</span>
                    </div>
                    <div className="pm-stat-row">
                      <span className="pm-stat-label">Capacity</span>
                      <span className="pm-stat-value">{planet.maxPopulation.toLocaleString()}</span>
                    </div>
                    <div className="pm-stat-row">
                      <span className="pm-stat-label">Utilisation</span>
                      <span className="pm-stat-value">
                        {planet.maxPopulation > 0 ? Math.round((planet.currentPopulation / planet.maxPopulation) * 100) : 0}%
                      </span>
                    </div>
                  </div>

                  <div className="pm-divider" />

                  <div className="pm-section-label">DEMOGRAPHICS</div>
                  <div className="pm-prod-empty" style={{ fontStyle: 'italic', fontSize: '10px' }}>
                    Detailed demographics coming soon — species breakdown, age groups, happiness distribution.
                  </div>
                </>
              )}

              {/* ── Orbitals tab ── */}
              {activeTab === 'orbitals' && (
                <>
                  <div className="pm-section-label">ORBITAL STRUCTURES</div>
                  {(() => {
                    const orbitalBuildings = planet.buildings.filter(b => ORBITAL_BUILDING_TYPES.has(b.type));
                    return orbitalBuildings.length === 0 ? (
                      <div className="pm-prod-empty">No orbital structures</div>
                    ) : (
                      <div className="pm-prod-group">
                        {orbitalBuildings.map(b => {
                          const bDef = BUILDING_DEFINITIONS[b.type];
                          return (
                            <div key={b.id} className="pm-stat-row">
                              <span className="pm-stat-label">{bDef?.name ?? b.type}</span>
                              <span className="pm-stat-value">Lv.{b.level}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  <div className="pm-divider" />

                  <div className="pm-section-label">SHIPS IN ORBIT</div>
                  <div className="pm-prod-empty" style={{ fontStyle: 'italic', fontSize: '10px' }}>
                    Ship listing will be wired in a future update.
                  </div>

                  <div className="pm-divider" />

                  <div className="pm-section-label">DEFENCES</div>
                  <div className="pm-prod-empty" style={{ fontStyle: 'italic', fontSize: '10px' }}>
                    Minefields, weapon platforms, and satellite networks coming soon.
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div className="pm-footer">
          <button className="pm-footer__btn pm-footer__btn--disabled" disabled>
            SPECIALIZE
          </button>
          <div className="pm-footer__totals">
            <span className="pm-footer__total-label">NET/TURN:</span>
            {RESOURCE_KEYS.map((key) => {
              const net = Math.round((netProduction[key] ?? 0) * 10) / 10;
              if (net === 0) return null;
              return (
                <span
                  key={key}
                  className={`pm-footer__total-item ${net > 0 ? 'pm-footer__total-item--pos' : 'pm-footer__total-item--neg'}`}
                >
                  {RESOURCE_ICONS[key]}: {net > 0 ? '+' : ''}{net}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Building picker modal */}
      {pickerOpen && (
        <BuildingPicker
          planet={planet}
          empireResources={empireResources}
          empireTechs={empireTechs}
          playerSpeciesId={playerSpeciesId}
          onSelect={handleSelectBuilding}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* Ship design picker modal */}
      {shipPickerOpen && (
        <ShipDesignPicker
          designs={savedDesigns}
          empireResources={empireResources}
          onSelect={handleSelectShipDesign}
          onClose={() => setShipPickerOpen(false)}
        />
      )}

      {/* Governor candidate selection modal */}
      {governorModalOpen && (
        <div className="bpicker-overlay" onClick={() => setGovernorModalOpen(false)}>
          <div
            className="bpicker pm-governor-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Select a governor"
          >
            <div className="bpicker__header">
              <span className="bpicker__title">SELECT GOVERNOR</span>
              <button
                className="panel-close-btn"
                onClick={() => setGovernorModalOpen(false)}
                aria-label="Close governor selection"
              >
                ✕
              </button>
            </div>

            <div className="pm-governor-modal__candidates">
              {candidates.map((candidate) => (
                <button
                  key={candidate.id}
                  className="pm-governor-card"
                  onClick={() => handleAppointCandidate(candidate)}
                >
                  <div className="pm-governor-card__name">{candidate.name}</div>
                  <div className="pm-governor-card__trait">{candidate.trait}</div>
                  <div className="pm-governor-card__mods">
                    {(Object.entries(candidate.modifiers) as [string, number][]).map(([key, val]) => (
                      <span
                        key={key}
                        className="pm-governor-card__mod"
                        style={{ color: val >= 0 ? '#4a9e5c' : '#cc4422' }}
                        title={GOVERNOR_MOD_LABELS[key] ?? key}
                      >
                        {GOVERNOR_MOD_LABELS[key]?.slice(0, 3).toUpperCase() ?? key}: {val >= 0 ? '+' : ''}{val}%
                      </span>
                    ))}
                  </div>
                  <div className="pm-governor-card__lifespan">
                    Lifespan: {candidate.lifespan} turns
                  </div>
                </button>
              ))}
            </div>

            <div className="pm-governor-modal__footer">
              <button
                className="pm-governor__replace-btn"
                onClick={handleRefreshCandidates}
                title="Costs 100 credits to refresh candidates"
              >
                Refresh Candidates (100 CR)
              </button>
              {/* Key is used to suppress the unused variable warning from the generation counter */}
              <span key={candidatesGeneration} style={{ display: 'none' }} />
            </div>
          </div>
        </div>
      )}

      {/* Demolish confirmation dialog */}
      {demolishTarget && (
        <div className="bpicker-overlay" onClick={handleDemolishCancel}>
          <div
            className="pm-demolish-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Confirm demolition"
          >
            <div className="pm-demolish-dialog__title">Demolish Building</div>
            <div className="pm-demolish-dialog__message">
              Demolish {getBuildingDisplayName(demolishTarget.type)}? This frees the building slot but the building is lost.
            </div>
            <div className="pm-demolish-dialog__actions">
              <button
                className="pm-demolish-dialog__btn pm-demolish-dialog__btn--cancel"
                onClick={handleDemolishCancel}
              >
                Cancel
              </button>
              <button
                className="pm-demolish-dialog__btn pm-demolish-dialog__btn--confirm"
                onClick={handleDemolishConfirm}
              >
                Demolish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
