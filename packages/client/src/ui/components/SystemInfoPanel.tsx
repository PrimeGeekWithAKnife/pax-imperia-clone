import React from 'react';
import type { StarSystem } from '@nova-imperia/shared';

interface SystemInfoPanelProps {
  system: StarSystem | null;
  /** Optional map of empireId → empire name for resolving owner display names. */
  empireNameMap?: Map<string, string>;
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

export function SystemInfoPanel({ system, empireNameMap }: SystemInfoPanelProps): React.ReactElement | null {
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
            {system.planets.map((planet) => (
              <li key={planet.id} className="planet-list-item">
                <span
                  className="planet-type-dot"
                  style={{ background: PLANET_TYPE_COLORS[planet.type] ?? '#888' }}
                />
                <span className="planet-name">{planet.name}</span>
                <span
                  className="planet-type-badge"
                  style={{ color: PLANET_TYPE_COLORS[planet.type] ?? '#888' }}
                >
                  {PLANET_TYPE_LABELS[planet.type] ?? planet.type}
                </span>
                {planet.ownerId && (
                  <span className="planet-colonized-badge">colonized</span>
                )}
              </li>
            ))}
            {system.planets.length === 0 && (
              <li className="planet-list-empty">No planets</li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
