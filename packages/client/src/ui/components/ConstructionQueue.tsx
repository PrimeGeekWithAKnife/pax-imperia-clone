import React from 'react';
import type { ProductionItem, BuildingType, Building } from '@nova-imperia/shared';
import { BUILDING_DEFINITIONS } from '@nova-imperia/shared';

interface ConstructionQueueProps {
  queue: ProductionItem[];
  onCancel: (index: number) => void;
  /** Planet's current buildings — used to resolve upgrade target levels. */
  buildings?: Building[];
}

function getBuildingName(templateId: string): string {
  const def = BUILDING_DEFINITIONS[templateId as BuildingType];
  return def?.name ?? templateId;
}

function getMaxTurns(templateId: string): number {
  const def = BUILDING_DEFINITIONS[templateId as BuildingType];
  return def?.buildTime ?? 10;
}

/**
 * Displays the planet's construction queue with progress bars and cancel buttons.
 */
export function ConstructionQueue({
  queue,
  onCancel,
  buildings,
}: ConstructionQueueProps): React.ReactElement {
  if (queue.length === 0) {
    return (
      <div className="cq-empty">
        No construction in progress
      </div>
    );
  }

  return (
    <div className="cq">
      {queue.map((item, index) => {
        const isUpgrade = item.type === 'building_upgrade';
        let name: string;
        if (isUpgrade && item.targetBuildingId && buildings) {
          const target = buildings.find(b => b.id === item.targetBuildingId);
          const bName = getBuildingName(item.templateId);
          name = target ? `Upgrading ${bName} → Lv.${target.level + 1}` : `Upgrading ${bName}`;
        } else {
          name = getBuildingName(item.templateId);
        }
        const maxTurns = item.totalTurns ?? getMaxTurns(item.templateId);
        const progressPct = Math.max(0, Math.min(100, ((maxTurns - item.turnsRemaining) / maxTurns) * 100));
        const isFirst = index === 0;

        return (
          <div key={index} className={`cq-item${isFirst ? ' cq-item--active' : ''}`}>
            <div className="cq-item__header">
              <span className="cq-item__name">{name}</span>
              <div className="cq-item__right">
                <span className="cq-item__turns">{Math.ceil(item.turnsRemaining)}t</span>
                <button
                  className="cq-item__cancel"
                  onClick={() => onCancel(index)}
                  aria-label={`Cancel ${name}`}
                  title="Cancel construction"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="cq-item__progress-track">
              <div
                className="cq-item__progress-fill"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {isFirst && (
              <div className="cq-item__status">{isUpgrade ? 'UPGRADING...' : 'BUILDING...'}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
