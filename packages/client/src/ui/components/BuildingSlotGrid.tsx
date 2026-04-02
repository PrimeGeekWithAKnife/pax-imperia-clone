import React, { useState } from 'react';
import type { Building, BuildingType } from '@nova-imperia/shared';
import { BUILDING_DEFINITIONS } from '@nova-imperia/shared';
import { renderBuildingSlotIcon } from '../../assets/graphics';

/** A building currently in the production queue. */
interface QueuedBuilding {
  type: string;
  targetZone?: 'surface' | 'orbital' | 'underground';
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

// -- SlotSection helper -------------------------------------------------------

interface SlotSectionProps {
  zone: 'surface' | 'orbital' | 'underground';
  slots: { used: number; total: number };
  buildings: Building[];
  queuedBuildings?: QueuedBuilding[];
  onEmptySlotClick: () => void;
  onBuildingClick: (building: Building, slotIndex: number) => void;
  onDemolish?: (building: Building) => void;
}

function SlotSection({
  zone,
  slots,
  buildings,
  queuedBuildings = [],
  onEmptySlotClick,
  onBuildingClick,
  onDemolish,
}: SlotSectionProps): React.ReactElement {
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

        return (
          <div
            key={index}
            className="bsg-slot bsg-slot--occupied"
            style={{ position: 'relative' }}
          >
            <button
              className="bsg-slot__main"
              onClick={() => onBuildingClick(building, index)}
              aria-label={`${def?.name ?? building.type} level ${building.level}`}
              title={`${def?.name ?? building.type} (Lv.${building.level})`}
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
          />
        </div>
      )}
    </div>
  );
}
