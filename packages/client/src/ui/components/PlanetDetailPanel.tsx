import React, { useCallback, useMemo } from 'react';
import type { Planet, Empire } from '@nova-imperia/shared';
import { calculateHabitability, canColonize } from '@nova-imperia/shared';

// ── Constants ────────────────────────────────────────────────────────────────

/** Base colonisation cost in credits. */
const BASE_COLONISE_COST = 200;

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
  defense_grid: 'Defence Grid',
  population_center: 'Population Centre',
  mining_facility: 'Mining Facility',
  spaceport: 'Spaceport',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function kelvinToCelsius(k: number): number {
  return Math.round(k - 273.15);
}

function formatPopulation(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function habitabilityColor(score: number): string {
  if (score >= 60) return '#44cc88';
  if (score >= 30) return '#ffcc44';
  return '#ff6644';
}

// ── Sub-components ────────────────────────────────────────────────────────────

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

function HabitabilityBar({ score }: { score: number }): React.ReactElement {
  const pct = Math.max(0, Math.min(100, score));
  const color = habitabilityColor(score);
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

// ── Props ─────────────────────────────────────────────────────────────────────

interface PlanetDetailPanelProps {
  planet: Planet | null;
  onClose?: () => void;
  /** The player's empire (used to determine ownership and colonisation eligibility). */
  playerEmpire?: Empire | null;
  /** Known empires for displaying enemy ownership. */
  knownEmpireMap?: Map<string, { name: string; color: string }>;
  /** System ID for the colonise action. */
  systemId?: string | null;
}

// ── PlanetDetailPanel ─────────────────────────────────────────────────────────

export function PlanetDetailPanel({
  planet,
  onClose,
  playerEmpire,
  knownEmpireMap,
  systemId,
}: PlanetDetailPanelProps): React.ReactElement | null {
  const visible = planet !== null;

  // ── Ownership determination ────────────────────────────────────────────────

  const ownership = useMemo((): 'player' | 'enemy' | 'unowned' => {
    if (!planet) return 'unowned';
    if (!planet.ownerId) return 'unowned';
    if (playerEmpire && planet.ownerId === playerEmpire.id) return 'player';
    return 'enemy';
  }, [planet, playerEmpire]);

  // ── Habitability (computed for unowned planets) ────────────────────────────

  const habitabilityReport = useMemo(() => {
    if (!planet || !playerEmpire || ownership !== 'unowned') return null;
    return calculateHabitability(planet, playerEmpire.species);
  }, [planet, playerEmpire, ownership]);

  // ── Colonisation eligibility ───────────────────────────────────────────────

  const colonisationStatus = useMemo((): {
    allowed: boolean;
    reason?: string;
    cost: number;
  } | null => {
    if (!planet || !playerEmpire || ownership !== 'unowned') return null;
    const baseCheck = canColonize(planet, playerEmpire.species);
    if (!baseCheck.allowed) {
      return { allowed: false, reason: baseCheck.reason, cost: BASE_COLONISE_COST };
    }
    if (playerEmpire.credits < BASE_COLONISE_COST) {
      return {
        allowed: false,
        reason: `Insufficient funds (need ${BASE_COLONISE_COST} CR, have ${playerEmpire.credits} CR)`,
        cost: BASE_COLONISE_COST,
      };
    }
    return { allowed: true, cost: BASE_COLONISE_COST };
  }, [planet, playerEmpire, ownership]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleColonise = useCallback(() => {
    if (!planet || !playerEmpire || !systemId) return;
    const game = (window as unknown as Record<string, unknown>).__EX_NIHILO_GAME__ as
      | { events: { emit: (e: string, d: unknown) => void } }
      | undefined;
    game?.events.emit('colony:colonise', {
      systemId,
      planetId: planet.id,
      empireId: playerEmpire.id,
    });
  }, [planet, playerEmpire, systemId]);

  const handleManageColony = useCallback(() => {
    if (!planet) return;
    const game = (window as unknown as Record<string, unknown>).__EX_NIHILO_GAME__ as
      | { events: { emit: (e: string, d: unknown) => void } }
      | undefined;
    game?.events.emit('planet:manage', { planet, systemId: systemId ?? '' });
  }, [planet, systemId]);

  // ── Enemy empire lookup ────────────────────────────────────────────────────

  const enemyEmpire = useMemo(() => {
    if (!planet?.ownerId || ownership !== 'enemy') return null;
    return knownEmpireMap?.get(planet.ownerId) ?? { name: planet.ownerId, color: '#888888' };
  }, [planet, ownership, knownEmpireMap]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className={`planet-detail-panel${visible ? ' planet-detail-panel--visible' : ''}`}
      aria-hidden={!visible}
    >
      {planet && (
        <>
          {/* ── Header ── */}
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

          {/* ── Environment ── */}
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

          {/* ── Resources & Population ── */}
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

          {ownership === 'player' && (
            <div className="panel-row">
              <span className="panel-label">Population</span>
              <span className="panel-value">
                {planet.currentPopulation > 0
                  ? formatPopulation(planet.currentPopulation)
                  : <span className="panel-value--muted">Colonising…</span>}
              </span>
            </div>
          )}

          {/* ── Colony status by ownership ── */}

          {/* Unowned planet */}
          {ownership === 'unowned' && (
            <>
              <div className="panel-divider" />
              <div className="panel-section-label">COLONISATION</div>

              {habitabilityReport && (
                <>
                  <div className="panel-row panel-row--column">
                    <span className="panel-label">
                      Habitability
                      {habitabilityReport.score < 10 && (
                        <span className="colonise-status colonise-status--danger"> ✕</span>
                      )}
                    </span>
                    <HabitabilityBar score={habitabilityReport.score} />
                  </div>

                  {habitabilityReport.warnings.length > 0 && (
                    <ul className="colonise-warnings">
                      {habitabilityReport.warnings.map((w, i) => (
                        <li key={i} className="colonise-warning-item">{w}</li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {colonisationStatus && (
                <>
                  <div className="panel-row">
                    <span className="panel-label">Cost</span>
                    <span className="panel-value">{colonisationStatus.cost} CR</span>
                  </div>

                  {!colonisationStatus.allowed && colonisationStatus.reason && (
                    <div className="colonise-reason">{colonisationStatus.reason}</div>
                  )}

                  <div className="colonise-action">
                    <button
                      className={`colonise-btn${colonisationStatus.allowed ? '' : ' colonise-btn--disabled'}`}
                      onClick={colonisationStatus.allowed ? handleColonise : undefined}
                      disabled={!colonisationStatus.allowed}
                      aria-disabled={!colonisationStatus.allowed}
                    >
                      Colonise
                    </button>
                  </div>
                </>
              )}

              {/* No player empire loaded yet */}
              {!playerEmpire && (
                <div className="colonise-reason">
                  No empire data available.
                </div>
              )}
            </>
          )}

          {/* Player-owned colony */}
          {ownership === 'player' && (
            <>
              <div className="panel-divider" />
              <div className="panel-section-label">YOUR COLONY</div>

              <div className="panel-row">
                <span className="panel-label">Buildings</span>
                <span className="panel-value">
                  {planet.buildings.length}
                  {planet.maxPopulation > 0 && (
                    <span className="panel-value--muted"> slots used</span>
                  )}
                </span>
              </div>

              {planet.productionQueue.length > 0 && (
                <div className="panel-row">
                  <span className="panel-label">Constructing</span>
                  <span className="panel-value">
                    {planet.productionQueue[0]!.templateId}
                    <span className="panel-value--muted">
                      {' '}({planet.productionQueue[0]!.turnsRemaining}t)
                    </span>
                  </span>
                </div>
              )}

              <div className="colonise-action">
                <button
                  className="colonise-btn colonise-btn--manage"
                  onClick={handleManageColony}
                >
                  Manage Colony
                </button>
              </div>
            </>
          )}

          {/* Enemy-owned planet */}
          {ownership === 'enemy' && enemyEmpire && (
            <>
              <div className="panel-divider" />
              <div className="panel-section-label">OWNERSHIP</div>

              <div className="panel-row">
                <span className="panel-label">Controlled By</span>
                <span
                  className="panel-value colonise-enemy-name"
                  style={{ color: enemyEmpire.color }}
                >
                  {enemyEmpire.name}
                </span>
              </div>
            </>
          )}

          {/* Fallback owner display when empire map is not available */}
          {ownership === 'enemy' && !enemyEmpire && (
            <>
              <div className="panel-divider" />
              <div className="panel-row">
                <span className="panel-label">Owner</span>
                <span className="panel-value panel-value--muted">{planet.ownerId}</span>
              </div>
            </>
          )}

          {/* ── Buildings ── */}
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

          {/* ── Production Queue ── */}
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
