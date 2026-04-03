import React, { useState, useCallback, useRef } from 'react';
import type { Building, BuildingType, TechAge } from '@nova-imperia/shared';
import { BUILDING_DEFINITIONS, BUILDING_LEVEL_MULTIPLIER, ZONE_MAINTENANCE_MULTIPLIER, canUpgradeBuilding, getUpgradeCost, getMaxLevelForAge } from '@nova-imperia/shared';
import type { Planet, EmpireResources } from '@nova-imperia/shared';
import { renderBuildingSlotIcon } from '../../assets/graphics';

/** A building currently in the production queue. */
interface QueuedBuilding {
  type: string;
  targetZone?: 'surface' | 'orbital' | 'underground';
}

/** Resource labels for tooltips */
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

/** UK English overrides for building names */
const UK_BUILDING_NAME_OVERRIDES: Partial<Record<BuildingType, string>> = {
  defense_grid: 'Defence Grid',
};

function getDisplayName(type: BuildingType): string {
  return UK_BUILDING_NAME_OVERRIDES[type] ?? BUILDING_DEFINITIONS[type].name;
}

interface BuildingSlotGridProps {
  surfaceSlots: { used: number; total: number };
  orbitalSlots: { used: number; total: number };
  undergroundSlots: { used: number; total: number };
  buildings: Building[];
  /** Buildings currently in the production queue (shown as "under construction"). */
  queuedBuildings?: QueuedBuilding[];
  /** Called when clicking an empty slot in a given zone */
  onEmptySlotClick: (zone: 'surface' | 'orbital' | 'underground') => void;
  /** Called when clicking an occupied slot (for future upgrade/info) */
  onBuildingClick: (building: Building, slotIndex: number) => void;
  /** Called when the player clicks the demolish button on an occupied slot. */
  onDemolish?: (building: Building) => void;
  /** Called when the player clicks the upgrade "+" button on an occupied slot. */
  onUpgrade?: (building: Building) => void;
  /** Planet data — needed for canUpgradeBuilding checks. */
  planet?: Planet;
  /** Empire resources — needed for affordability checks on upgrade. */
  empireResources?: EmpireResources;
  /** Current tech age — gates upgrade level caps. */
  currentAge?: TechAge;
}

const BUILDING_ABBREV: Record<BuildingType, string> = {
  research_lab: 'RL',
  factory: 'FA',
  shipyard: 'SY',
  trade_hub: 'TH',
  defense_grid: 'DG',
  population_center: 'PC',
  mining_facility: 'MF',
  spaceport: 'SP',
  power_plant: 'PP',
  entertainment_complex: 'EC',
  hydroponics_bay: 'HB',
  orbital_platform: 'OP',
  recycling_plant: 'RC',
  communications_hub: 'CH',
  terraforming_station: 'TF',
  military_academy: 'MA',
  fusion_reactor: 'FR',
  medical_bay: 'MB',
  advanced_medical_centre: 'AM',
  // -- Waste & environment ------------------------------------------------
  waste_dump: 'WD',
  waste_incinerator: 'WI',
  atmosphere_cleanser: 'AC',
  orbital_waste_ejector: 'OW',
  energy_storage: 'ES',
  // -- Vaelori -------------------------------------------------------------
  crystal_resonance_chamber: 'CR',
  psionic_amplifier: 'PA',
  // -- Khazari -------------------------------------------------------------
  war_forge: 'WF',
  magma_tap: 'MT',
  // -- Sylvani -------------------------------------------------------------
  living_archive: 'LA',
  growth_vat: 'GV',
  // -- Nexari --------------------------------------------------------------
  neural_network_hub: 'NN',
  assimilation_node: 'AN',
  // -- Drakmari ------------------------------------------------------------
  abyssal_processor: 'AP',
  predator_arena: 'PR',
  // -- Teranos -------------------------------------------------------------
  diplomatic_quarter: 'DQ',
  innovation_lab: 'IL',
  // -- Zorvathi ------------------------------------------------------------
  deep_hive: 'DH',
  tunnel_network: 'TN',
  // -- Ashkari -------------------------------------------------------------
  salvage_yard: 'SV',
  black_market: 'BM',
  // -- Luminari ------------------------------------------------------------
  plasma_conduit: 'PL',
  dimensional_resonator: 'DR',
  // -- Vethara -------------------------------------------------------------
  bonding_chamber: 'BC',
  neural_integration_centre: 'NI',
  // -- Kaelenth ------------------------------------------------------------
  data_archive: 'DA',
  replication_forge: 'RF',
  // -- Thyriaq -------------------------------------------------------------
  reconfiguration_matrix: 'RM',
  substrate_processor: 'SB',
  // -- Aethyn --------------------------------------------------------------
  dimensional_anchor: 'DI',
  phase_laboratory: 'PH',
  // -- Orivani -------------------------------------------------------------
  grand_cathedral: 'GC',
  reliquary_vault: 'RV',
  // -- Pyrenth -------------------------------------------------------------
  elemental_forge: 'EF',
  seismic_resonator: 'SR',
  // -- Tiered food buildings ------------------------------------------------
  concentrated_farming: 'CF',
  greenhouse_farming: 'GF',
  // -- Zone infrastructure -------------------------------------------------
  underground_complex: 'UC',
};

/** Pixel size of each building slot cell -- must match the CSS `.bsg-slot` dimensions. */
const CELL_SIZE = 64;

function getBuildingDef(type: BuildingType) {
  return BUILDING_DEFINITIONS[type];
}

// -- Building slot icon with text fallback ------------------------------------

interface SlotIconProps {
  buildingType: BuildingType;
  level: number;
}

/**
 * Renders the building slot icon produced by `renderBuildingSlotIcon`.
 * Falls back to the two-letter abbreviation if the data URI is empty
 * (stub not yet replaced) or if the image fails to load.
 */
function SlotIcon({ buildingType, level }: SlotIconProps): React.ReactElement {
  const src = renderBuildingSlotIcon(buildingType, level, CELL_SIZE);
  const abbrev = BUILDING_ABBREV[buildingType] ?? '??';
  const [imgFailed, setImgFailed] = useState(false);

  if (!src || imgFailed) {
    return <span className="bsg-slot__icon">{abbrev}</span>;
  }

  return (
    <img
      src={src}
      alt={abbrev}
      className="bsg-slot__icon-img"
      width={CELL_SIZE}
      height={CELL_SIZE}
      onError={() => setImgFailed(true)}
    />
  );
}

// -- Building hover tooltip ----------------------------------------------------

interface BuildingTooltipProps {
  building: Building;
  def: ReturnType<typeof getBuildingDef>;
  currentAge: TechAge;
}

function BuildingTooltip({ building, def, currentAge }: BuildingTooltipProps): React.ReactElement | null {
  if (!def) return null;

  const lvlMult = Math.pow(BUILDING_LEVEL_MULTIPLIER, building.level - 1);
  const isMaxLevel = building.level >= def.maxLevel;
  const ageCap = getMaxLevelForAge(building.type, currentAge);
  const isAgeCapped = building.level >= ageCap && !isMaxLevel;

  // Collect current effects
  const effects: Array<{ label: string; value: string; positive: boolean }> = [];

  for (const [key, base] of Object.entries(def.baseProduction)) {
    if (base && base > 0) {
      const scaled = Math.round(base * lvlMult * 10) / 10;
      effects.push({ label: RESOURCE_LABELS[key] ?? key, value: `+${scaled}`, positive: true });
    }
  }

  if (def.energyConsumption > 0) {
    const scaled = Math.round(def.energyConsumption * lvlMult * 10) / 10;
    effects.push({ label: 'Energy draw', value: `-${scaled}`, positive: false });
  }

  if (def.wasteOutput > 0) {
    const scaled = Math.round(def.wasteOutput * lvlMult * 10) / 10;
    effects.push({ label: 'Waste', value: `+${scaled}`, positive: false });
  }

  const bldgZoneMult = ZONE_MAINTENANCE_MULTIPLIER[building.slotZone ?? 'surface'] ?? 1;
  for (const [key, base] of Object.entries(def.maintenanceCost)) {
    if (base && base > 0) {
      const maintCost = Math.round(base * bldgZoneMult * 10) / 10;
      effects.push({ label: `${RESOURCE_LABELS[key] ?? key} maint.`, value: `-${maintCost}`, positive: false });
    }
  }

  if (def.happinessImpact !== 0) {
    effects.push({
      label: 'Happiness',
      value: `${def.happinessImpact > 0 ? '+' : ''}${def.happinessImpact}`,
      positive: def.happinessImpact > 0,
    });
  }

  if (def.populationCapacityBonus) {
    const scaled = def.populationCapacityBonus * building.level;
    effects.push({ label: 'Pop. capacity', value: `+${(scaled / 1_000_000).toFixed(1)}M`, positive: true });
  }

  if (def.specialEffects) {
    for (const fx of def.specialEffects) {
      effects.push({ label: fx, value: '', positive: true });
    }
  }

  // Next level preview
  let nextLevelEffects: Array<{ label: string; value: string; positive: boolean }> | null = null;
  if (!isMaxLevel && !isAgeCapped) {
    const nextMult = Math.pow(BUILDING_LEVEL_MULTIPLIER, building.level);
    nextLevelEffects = [];
    for (const [key, base] of Object.entries(def.baseProduction)) {
      if (base && base > 0) {
        const scaled = Math.round(base * nextMult * 10) / 10;
        nextLevelEffects.push({ label: RESOURCE_LABELS[key] ?? key, value: `+${scaled}`, positive: true });
      }
    }
  }

  return (
    <div className="bsg-tooltip" onClick={(e) => e.stopPropagation()}>
      <div className="bsg-tooltip__header">
        <span className="bsg-tooltip__name">{getDisplayName(building.type)}</span>
        <span className="bsg-tooltip__level">
          Lv.{building.level}{isMaxLevel ? ' (MAX)' : isAgeCapped ? ` / ${ageCap}` : ` / ${def.maxLevel}`}
        </span>
      </div>

      {effects.length > 0 && (
        <div className="bsg-tooltip__effects">
          {effects.map((e, i) => (
            <div key={i} className="bsg-tooltip__effect-row">
              <span className="bsg-tooltip__effect-label">{e.label}</span>
              {e.value && (
                <span
                  className="bsg-tooltip__effect-value"
                  style={{ color: e.positive ? '#44cc88' : '#cc6644' }}
                >
                  {e.value}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {nextLevelEffects && nextLevelEffects.length > 0 && (
        <div className="bsg-tooltip__next">
          <span className="bsg-tooltip__next-label">Lv.{building.level + 1} output:</span>
          {nextLevelEffects.map((e, i) => (
            <span key={i} className="bsg-tooltip__next-value" style={{ color: '#44cc88' }}>
              {e.label}: {e.value}
            </span>
          ))}
        </div>
      )}

      {isMaxLevel && (
        <div className="bsg-tooltip__status">Maximum level reached</div>
      )}
      {isAgeCapped && (
        <div className="bsg-tooltip__status" style={{ color: '#cc8844' }}>
          Technology advancement required
        </div>
      )}
    </div>
  );
}

// -- SlotSection helper -------------------------------------------------------

interface SlotSectionProps {
  zone: 'surface' | 'orbital' | 'underground';
  slots: { used: number; total: number };
  buildings: Building[];
  queuedBuildings?: QueuedBuilding[];
  onEmptySlotClick: () => void;
  onBuildingClick: (building: Building, slotIndex: number) => void;
  onDemolish?: (building: Building) => void;
  onUpgrade?: (building: Building) => void;
  planet?: Planet;
  empireResources?: EmpireResources;
  currentAge?: TechAge;
}

function SlotSection({
  zone,
  slots,
  buildings,
  queuedBuildings = [],
  onEmptySlotClick,
  onBuildingClick,
  onDemolish,
  onUpgrade,
  planet,
  empireResources,
  currentAge = 'nano_atomic',
}: SlotSectionProps): React.ReactElement {
  const [hoveredBuildingId, setHoveredBuildingId] = useState<string | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slotRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const handleMouseEnter = useCallback((buildingId: string) => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    tooltipTimerRef.current = setTimeout(() => setHoveredBuildingId(buildingId), 250);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    tooltipTimerRef.current = null;
    setHoveredBuildingId(null);
  }, []);
  // Build slot array: existing buildings first, then queued, then empty
  const slotArray: Array<Building | QueuedBuilding | null> = [];
  for (let i = 0; i < slots.total; i++) {
    if (i < buildings.length) {
      slotArray.push(buildings[i]);
    } else if (i - buildings.length < queuedBuildings.length) {
      slotArray.push(queuedBuildings[i - buildings.length]);
    } else {
      slotArray.push(null);
    }
  }

  return (
    <div
      className="bsg"
      style={{ '--bsg-cols': Math.min(5, slots.total) } as React.CSSProperties}
      data-zone={zone}
    >
      {slotArray.map((building, index) => {
        if (building === null) {
          return (
            <button
              key={index}
              className="bsg-slot bsg-slot--empty"
              onClick={onEmptySlotClick}
              aria-label={`Empty ${zone} slot ${index + 1} -- click to build`}
              title={`Empty ${zone} slot -- click to build`}
            >
              <span className="bsg-slot__plus">+</span>
            </button>
          );
        }

        // Queued building — show "under construction" visual
        if (!('id' in building)) {
          const qDef = getBuildingDef(building.type as BuildingType);
          const abbrev = BUILDING_ABBREV[building.type as BuildingType] ?? '??';
          return (
            <div
              key={`q-${index}`}
              className="bsg-slot bsg-slot--constructing"
              title={`${qDef?.name ?? building.type} (Under Construction)`}
              style={{
                position: 'relative',
                opacity: 0.6,
                border: '1px dashed rgba(0, 180, 255, 0.5)',
              }}
            >
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
              }}>
                <span className="bsg-slot__icon" style={{ color: '#0088cc' }}>{abbrev}</span>
                <span style={{ fontSize: '8px', color: '#0088cc', marginTop: '2px' }}>Building...</span>
              </div>
            </div>
          );
        }

        const def = getBuildingDef(building.type);

        // Upgrade availability check
        const upgradeCheck = planet ? canUpgradeBuilding(planet, building.id, currentAge) : { allowed: false, reason: 'No planet data' };
        const isMaxLevel = building.level >= (def?.maxLevel ?? 99);
        const ageCap = getMaxLevelForAge(building.type, currentAge);
        const isAgeCapped = building.level >= ageCap && !isMaxLevel;
        const upgradeCost = getUpgradeCost(building.type, building.level);
        const canAffordUpgrade = empireResources
          ? Object.entries(upgradeCost).every(([key, amount]) =>
              (empireResources[key as keyof EmpireResources] ?? 0) >= (amount ?? 0),
            )
          : false;
        const upgradeEnabled = upgradeCheck.allowed && canAffordUpgrade;

        // Build the upgrade tooltip reason
        let upgradeTooltip: string;
        if (isMaxLevel) {
          upgradeTooltip = 'Maximum level reached';
        } else if (isAgeCapped) {
          upgradeTooltip = 'Technology advancement required for further upgrades';
        } else if (!upgradeCheck.allowed) {
          upgradeTooltip = upgradeCheck.reason ?? 'Cannot upgrade';
        } else if (!canAffordUpgrade) {
          const missing = Object.entries(upgradeCost)
            .filter(([key, amount]) => (empireResources?.[key as keyof EmpireResources] ?? 0) < (amount ?? 0))
            .map(([key, amount]) => `${RESOURCE_ICONS[key] ?? key}: need ${amount}, have ${Math.floor(empireResources?.[key as keyof EmpireResources] ?? 0)}`)
            .join(', ');
          upgradeTooltip = `Insufficient resources — ${missing}`;
        } else {
          upgradeTooltip = `Upgrade to Lv.${building.level + 1}`;
        }

        const isHovered = hoveredBuildingId === building.id;

        return (
          <div
            key={index}
            className="bsg-slot bsg-slot--occupied"
            style={{ position: 'relative' }}
            ref={(el) => { if (el) slotRefs.current.set(building.id, el); }}
            onMouseEnter={() => handleMouseEnter(building.id)}
            onMouseLeave={handleMouseLeave}
          >
            <button
              className="bsg-slot__main"
              onClick={() => onBuildingClick(building, index)}
              aria-label={`${def?.name ?? building.type} level ${building.level}`}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
              }}
            >
              <SlotIcon buildingType={building.type} level={building.level} />
              <span className="bsg-slot__level">Lv.{building.level}</span>
            </button>
            {/* Upgrade "+" button — top-left */}
            {onUpgrade && !isMaxLevel && (
              <button
                className={`bsg-slot__upgrade ${upgradeEnabled ? '' : 'bsg-slot__upgrade--disabled'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (upgradeEnabled) onUpgrade(building);
                }}
                aria-label={upgradeTooltip}
                title={upgradeTooltip}
              >
                +
              </button>
            )}
            {onDemolish && (
              <button
                className="bsg-slot__demolish"
                onClick={(e) => {
                  e.stopPropagation();
                  onDemolish(building);
                }}
                aria-label={`Demolish ${def?.name ?? building.type}`}
                title={`Demolish ${def?.name ?? building.type}`}
              >
                ✕
              </button>
            )}
            {/* Hover tooltip */}
            {isHovered && def && (
              <BuildingTooltip building={building} def={def} currentAge={currentAge} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Renders a visual grid of building slots, split into surface, orbital, and
 * underground zone sections. Orbital and underground sections are only shown
 * when the planet has slots in those zones.
 */
export function BuildingSlotGrid({
  surfaceSlots,
  orbitalSlots,
  undergroundSlots,
  buildings,
  queuedBuildings = [],
  onEmptySlotClick,
  onBuildingClick,
  onDemolish,
  onUpgrade,
  planet,
  empireResources,
  currentAge,
}: BuildingSlotGridProps): React.ReactElement {
  const surfaceBuildings = buildings.filter(b => (b.slotZone ?? 'surface') === 'surface');
  const orbitalBuildings = buildings.filter(b => b.slotZone === 'orbital');
  const undergroundBuildings = buildings.filter(b => b.slotZone === 'underground');

  const surfaceQueued = queuedBuildings.filter(q => (q.targetZone ?? 'surface') === 'surface');
  const orbitalQueued = queuedBuildings.filter(q => q.targetZone === 'orbital');
  const undergroundQueued = queuedBuildings.filter(q => q.targetZone === 'underground');

  return (
    <div className="bsg-zones">
      {/* Surface */}
      <SlotSection
        zone="surface"
        slots={surfaceSlots}
        buildings={surfaceBuildings}
        queuedBuildings={surfaceQueued}
        onEmptySlotClick={() => onEmptySlotClick('surface')}
        onBuildingClick={onBuildingClick}
        onDemolish={onDemolish}
        onUpgrade={onUpgrade}
        planet={planet}
        empireResources={empireResources}
        currentAge={currentAge}
      />

      {/* Orbital */}
      {orbitalSlots.total > 0 && (
        <div className="bsg-section bsg-section--orbital">
          <div className="bsg-section__label">ORBITAL ({orbitalSlots.used}/{orbitalSlots.total})</div>
          <SlotSection
            zone="orbital"
            slots={orbitalSlots}
            buildings={orbitalBuildings}
            queuedBuildings={orbitalQueued}
            onEmptySlotClick={() => onEmptySlotClick('orbital')}
            onBuildingClick={onBuildingClick}
            onDemolish={onDemolish}
            onUpgrade={onUpgrade}
            planet={planet}
            empireResources={empireResources}
            currentAge={currentAge}
          />
        </div>
      )}

      {/* Underground */}
      {undergroundSlots.total > 0 && (
        <div className="bsg-section bsg-section--underground">
          <div className="bsg-section__label">UNDERGROUND ({undergroundSlots.used}/{undergroundSlots.total})</div>
          <SlotSection
            zone="underground"
            slots={undergroundSlots}
            buildings={undergroundBuildings}
            queuedBuildings={undergroundQueued}
            onEmptySlotClick={() => onEmptySlotClick('underground')}
            onBuildingClick={onBuildingClick}
            onDemolish={onDemolish}
            onUpgrade={onUpgrade}
            planet={planet}
            empireResources={empireResources}
            currentAge={currentAge}
          />
        </div>
      )}
    </div>
  );
}
