import React from 'react';
import type { StarSystem, Planet } from '@nova-imperia/shared';

interface SystemInfoPanelProps {
  system: StarSystem | null;
  /** Optional map of empireId → empire name for resolving owner display names. */
  empireNameMap?: Map<string, string>;
  /** Fired when the player double-clicks a planet in the list. */
  onPlanetDoubleClick?: (planet: Planet, system: StarSystem) => void;
}

const STAR_COLORS: Record<string, string> = {
  blue_giant: '#4488ff',
  white: '#eeeeff',
  yellow: '#ffdd44',
  orange: '#ff8833',
  red_dwarf: '#ff4422',
  red_giant: '#ff2211',
  neutron: '#aaffee',
  binary: '#ffff88',
};

const STAR_LABELS: Record<string, string> = {
  blue_giant: 'Blue Giant',
  white: 'White Star',
  yellow: 'Yellow Star',
  orange: 'Orange Star',
  red_dwarf: 'Red Dwarf',
  red_giant: 'Red Giant',
  neutron: 'Neutron Star',
  binary: 'Binary System',
};

const PLANET_TYPE_LABELS: Record<string, string> = {
  terran: 'Terran',
  ocean: 'Ocean',
  desert: 'Desert',
  ice: 'Ice',
  volcanic: 'Volcanic',
  gas_giant: 'Gas Giant',
  barren: 'Barren',
  toxic: 'Toxic',
};

const PLANET_TYPE_COLORS: Record<string, string> = {
  terran: '#44cc66',
  ocean: '#3399ff',
  desert: '#ddaa44',
  ice: '#aaddff',
  volcanic: '#ff5522',
  gas_giant: '#cc88ff',
  barren: '#888888',
  toxic: '#99cc33',
};

/** Traffic-light colour for colony health based on happiness score. */
function getHealthColor(happiness: number): string {
  if (happiness >= 70) return '#10b981'; // green
  if (happiness >= 40) return '#f59e0b'; // amber
  return '#ef4444'; // red
}

/** Client-side happiness estimate from planet buildings and population. */
function estimateHappiness(planet: Planet): number {
  if (!planet.ownerId || planet.currentPopulation <= 0) return -1;
  let score = 60;
  for (const b of planet.buildings) {
    if (b.type === 'entertainment_complex') score += 10 * b.level;
  }
  if (planet.maxPopulation > 0) {
    const density = planet.currentPopulation / planet.maxPopulation;
    if (density > 0.95) score -= 20;
    else if (density > 0.80) score -= 10;
    else if (density < 0.50) score += 10;
  }
  score -= 5;
  return Math.max(0, Math.min(100, score));
}

function formatPopulation(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function SystemInfoPanel({ system, empireNameMap, onPlanetDoubleClick }: SystemInfoPanelProps): React.ReactElement | null {
  const visible = system !== null;

  return (
    <div
      className={`system-info-panel${visible ? ' system-info-panel--visible' : ''}`}
      aria-hidden={!visible}
    >
      {system && (
        <>
          <div className="panel-header">
            <span
              className="star-dot"
              style={{ background: STAR_COLORS[system.starType] ?? '#ffffff' }}
            />
            <h2 className="panel-title">{system.name}</h2>
          </div>

          <div className="panel-row">
            <span className="panel-label">Star Type</span>
            <span
              className="panel-value"
              style={{ color: STAR_COLORS[system.starType] ?? '#ffffff' }}
            >
              {STAR_LABELS[system.starType] ?? system.starType}
            </span>
          </div>

          <div className="panel-row">
            <span className="panel-label">Planets</span>
            <span className="panel-value">{system.planets.length}</span>
          </div>

          <div className="panel-row">
            <span className="panel-label">Wormholes</span>
            <span className="panel-value">{system.wormholes.length}</span>
          </div>

          <div className="panel-row">
            <span className="panel-label">Owner</span>
            <span className="panel-value panel-value--muted">
              {system.ownerId
                ? (empireNameMap?.get(system.ownerId) ?? system.ownerId)
                : 'Unclaimed'}
            </span>
          </div>

          <div className="panel-divider" />

          <div className="panel-section-label">PLANETS</div>

          <ul className="planet-list">
            {system.planets.map((planet) => {
              const hp = estimateHappiness(planet);
              const isColony = planet.ownerId != null && planet.currentPopulation > 0;
              const isOvercrowded = planet.maxPopulation > 0 && planet.currentPopulation / planet.maxPopulation > 0.95;
              return (
                <li
                  key={planet.id}
                  className="planet-list-item"
                  style={{ flexWrap: 'wrap', cursor: onPlanetDoubleClick ? 'pointer' : undefined }}
                  onDoubleClick={() => onPlanetDoubleClick?.(planet, system)}
                >
                  {isColony ? (
                    <span
                      title={`Colony health: ${hp}`}
                      style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: getHealthColor(hp),
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <span
                      className="planet-type-dot"
                      style={{ background: PLANET_TYPE_COLORS[planet.type] ?? '#888' }}
                    />
                  )}
                  <span className="planet-name">{planet.name}</span>
                  {isColony && (
                    <span style={{ color: '#8899aa', fontSize: '10px', marginLeft: '4px' }}>
                      {formatPopulation(planet.currentPopulation)}
                    </span>
                  )}
                  <span
                    className="planet-type-badge"
                    style={{ color: PLANET_TYPE_COLORS[planet.type] ?? '#888' }}
                  >
                    {PLANET_TYPE_LABELS[planet.type] ?? planet.type}
                  </span>
                  {planet.ownerId && (
                    <span className="planet-colonized-badge">colonised</span>
                  )}
                  {isColony && (hp < 30 || isOvercrowded) && (
                    <div style={{ width: '100%', display: 'flex', gap: '3px', paddingLeft: '16px', marginTop: '2px' }}>
                      {hp < 30 && (
                        <span style={{
                          fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase',
                          padding: '0px 4px', borderRadius: '2px',
                          background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444',
                        }}>
                          Unrest
                        </span>
                      )}
                      {isOvercrowded && (
                        <span style={{
                          fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase',
                          padding: '0px 4px', borderRadius: '2px',
                          background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444',
                        }}>
                          Overcrowded
                        </span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
            {system.planets.length === 0 && (
              <li className="planet-list-empty">No planets</li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
