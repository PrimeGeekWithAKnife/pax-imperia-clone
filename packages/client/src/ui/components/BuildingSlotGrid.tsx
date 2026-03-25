import React, { useState } from 'react';
import type { Building, BuildingType } from '@nova-imperia/shared';
import { BUILDING_DEFINITIONS } from '@nova-imperia/shared';
import { renderBuildingSlotIcon } from '../../assets/graphics';

interface BuildingSlotGridProps {
  totalSlots: number;
  buildings: Building[];
  /** Called when clicking an empty slot */
  onEmptySlotClick: (slotIndex: number) => void;
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

/**
 * Renders a visual grid of building slots.
 * Filled slots show the building icon, name, and level.
 * Empty slots show a "+" and accept click to open a picker.
 */
export function BuildingSlotGrid({
  totalSlots,
  buildings,
  onEmptySlotClick,
  onBuildingClick,
  onDemolish,
}: BuildingSlotGridProps): React.ReactElement {
  const slots: Array<Building | null> = Array.from({ length: totalSlots }, (_, i) => buildings[i] ?? null);

  return (
    <div className="bsg" style={{ '--bsg-cols': Math.min(5, totalSlots) } as React.CSSProperties}>
      {slots.map((building, index) => {
        if (building === null) {
          return (
            <button
              key={index}
              className="bsg-slot bsg-slot--empty"
              onClick={() => onEmptySlotClick(index)}
              aria-label={`Empty slot ${index + 1} -- click to build`}
              title="Empty slot -- click to build"
            >
              <span className="bsg-slot__plus">+</span>
            </button>
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
