import React from 'react';
import type { ProductionItem, BuildingType } from '@nova-imperia/shared';
import { BUILDING_DEFINITIONS } from '@nova-imperia/shared';

interface ConstructionQueueProps {
  queue: ProductionItem[];
  onCancel: (index: number) => void;
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
        const name = getBuildingName(item.templateId);
        const maxTurns = getMaxTurns(item.templateId);
        const progressPct = Math.max(0, Math.min(100, ((maxTurns - item.turnsRemaining) / maxTurns) * 100));
        const isFirst = index === 0;

        return (
          <div key={index} className={`cq-item${isFirst ? ' cq-item--active' : ''}`}>
            <div className="cq-item__header">
              <span className="cq-item__name">{name}</span>
              <div className="cq-item__right">
                <span className="cq-item__turns">{item.turnsRemaining}t</span>
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
              <div className="cq-item__status">BUILDING...</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
