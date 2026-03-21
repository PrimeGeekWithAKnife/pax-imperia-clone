import React from 'react';
import type { Planet } from '@nova-imperia/shared';

interface PlanetDetailPanelProps {
  planet: Planet | null;
  onClose?: () => void;
}

const ATMOSPHERE_LABELS: Record<string, string> = {
  oxygen_nitrogen: 'Oxygen-Nitrogen',
  carbon_dioxide: 'Carbon Dioxide',
  methane: 'Methane',
  ammonia: 'Ammonia',
  none: 'None (Vacuum)',
  toxic: 'Toxic',
  hydrogen_helium: 'Hydrogen-Helium',
};

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

const BUILDING_TYPE_LABELS: Record<string, string> = {
  research_lab: 'Research Lab',
  factory: 'Factory',
  shipyard: 'Shipyard',
  trade_hub: 'Trade Hub',
  defense_grid: 'Defense Grid',
  population_center: 'Population Center',
  mining_facility: 'Mining Facility',
  spaceport: 'Spaceport',
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

function ResourceBar({ value }: { value: number }): React.ReactElement {
  const pct = Math.max(0, Math.min(100, value));
  const color =
    pct >= 70 ? '#00d4ff' : pct >= 40 ? '#ffaa00' : '#ff4444';
  return (
    <div className="resource-bar-track">
      <div
        className="resource-bar-fill"
        style={{ width: `${pct}%`, background: color }}
      />
      <span className="resource-bar-label">{pct}/100</span>
    </div>
  );
}

export function PlanetDetailPanel({
  planet,
  onClose,
}: PlanetDetailPanelProps): React.ReactElement | null {
  const visible = planet !== null;

  return (
    <div
      className={`planet-detail-panel${visible ? ' planet-detail-panel--visible' : ''}`}
      aria-hidden={!visible}
    >
      {planet && (
        <>
          <div className="panel-header">
            <div>
              <h2 className="panel-title">{planet.name}</h2>
              <div className="panel-subtitle">
                {PLANET_TYPE_LABELS[planet.type] ?? planet.type}
              </div>
            </div>
            {onClose && (
              <button
                className="panel-close-btn"
                onClick={onClose}
                aria-label="Close planet detail"
              >
                ✕
              </button>
            )}
          </div>

          <div className="panel-divider" />
          <div className="panel-section-label">ENVIRONMENT</div>

          <div className="panel-row">
            <span className="panel-label">Atmosphere</span>
            <span className="panel-value">
              {ATMOSPHERE_LABELS[planet.atmosphere] ?? planet.atmosphere}
            </span>
          </div>

          <div className="panel-row">
            <span className="panel-label">Gravity</span>
            <span className="panel-value">
              {planet.gravity.toFixed(2)}g
              {planet.gravity < 0.7 && (
                <span className="panel-value--muted"> (low)</span>
              )}
              {planet.gravity > 1.3 && (
                <span className="panel-value--muted"> (high)</span>
              )}
            </span>
          </div>

          <div className="panel-row">
            <span className="panel-label">Temperature</span>
            <span className="panel-value">
              {planet.temperature}K
              <span className="panel-value--muted">
                {' '}({kelvinToCelsius(planet.temperature)}°C)
              </span>
            </span>
          </div>

          <div className="panel-divider" />
          <div className="panel-section-label">RESOURCES &amp; POPULATION</div>

          <div className="panel-row panel-row--column">
            <span className="panel-label">Natural Resources</span>
            <ResourceBar value={planet.naturalResources} />
          </div>

          <div className="panel-row">
            <span className="panel-label">Max Population</span>
            <span className="panel-value">{formatPopulation(planet.maxPopulation)}</span>
          </div>

          <div className="panel-row">
            <span className="panel-label">Population</span>
            <span className="panel-value">
              {planet.currentPopulation > 0
                ? formatPopulation(planet.currentPopulation)
                : <span className="panel-value--muted">Uninhabited</span>}
            </span>
          </div>

          <div className="panel-row">
            <span className="panel-label">Owner</span>
            <span className="panel-value panel-value--muted">
              {planet.ownerId ?? 'Unclaimed'}
            </span>
          </div>

          {planet.buildings.length > 0 && (
            <>
              <div className="panel-divider" />
              <div className="panel-section-label">BUILDINGS</div>
              <ul className="building-list">
                {planet.buildings.map((b) => (
                  <li key={b.id} className="building-list-item">
                    <span className="building-name">
                      {BUILDING_TYPE_LABELS[b.type] ?? b.type}
                    </span>
                    <span className="building-level">Lv.{b.level}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {planet.productionQueue.length > 0 && (
            <>
              <div className="panel-divider" />
              <div className="panel-section-label">PRODUCTION QUEUE</div>
              <ul className="building-list">
                {planet.productionQueue.map((item, i) => (
                  <li key={i} className="building-list-item">
                    <span className="building-name">{item.templateId}</span>
                    <span className="building-level">{item.turnsRemaining}t</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
