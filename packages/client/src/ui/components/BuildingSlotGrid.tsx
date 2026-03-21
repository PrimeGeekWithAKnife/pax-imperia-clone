import React from 'react';
import type { Building, BuildingType } from '@nova-imperia/shared';
import { BUILDING_DEFINITIONS } from '@nova-imperia/shared';

interface BuildingSlotGridProps {
  totalSlots: number;
  buildings: Building[];
  /** Called when clicking an empty slot */
  onEmptySlotClick: (slotIndex: number) => void;
  /** Called when clicking an occupied slot (for future upgrade/info) */
  onBuildingClick: (building: Building, slotIndex: number) => void;
}

const BUILDING_ICONS: Record<BuildingType, string> = {
  research_lab: 'R',
  factory: 'F',
  shipyard: 'S',
  trade_hub: 'T',
  defense_grid: 'D',
  population_center: 'P',
  mining_facility: 'M',
  spaceport: 'O',
};

function getBuildingDef(type: BuildingType) {
  return BUILDING_DEFINITIONS[type];
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
              aria-label={`Empty slot ${index + 1} — click to build`}
              title="Empty slot — click to build"
            >
              <span className="bsg-slot__plus">+</span>
            </button>
          );
        }

        const def = getBuildingDef(building.type);
        const icon = BUILDING_ICONS[building.type] ?? '?';

        return (
          <button
            key={index}
            className="bsg-slot bsg-slot--occupied"
            onClick={() => onBuildingClick(building, index)}
            aria-label={`${def?.name ?? building.type} level ${building.level}`}
            title={`${def?.name ?? building.type} (Lv.${building.level})`}
          >
            <span className="bsg-slot__icon">{icon}</span>
            <span className="bsg-slot__level">Lv.{building.level}</span>
          </button>
        );
      })}
    </div>
  );
}
