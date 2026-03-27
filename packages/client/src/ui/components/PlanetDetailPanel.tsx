import React, { useCallback, useMemo } from 'react';
import type { Planet, Empire, Ship } from '@nova-imperia/shared';
import type { EmpireResources } from '@nova-imperia/shared';
import { calculateHabitability, canColonize, COLONISATION_MINERAL_COST, COLONIST_TRANSFER_COUNT, PLANET_SIZE_LABELS, PLANET_SIZE_SLOTS } from '@nova-imperia/shared';

// ── Constants ────────────────────────────────────────────────────────────────

/** Base colonisation cost in credits. */
const BASE_COLONISE_COST = 10_000;

const ATMOSPHERE_LABELS: Record<string, string> = {
  oxygen_nitrogen: 'Oxygen-Nitrogen',
  carbon_dioxide: 'Carbon Dioxide',
  methane: 'Methane',
  ammonia: 'Ammonia',
  nitrogen: 'Nitrogen',
  hydrogen: 'Hydrogen',
  hydrogen_helium: 'Hydrogen-Helium',
  sulfur_dioxide: 'Sulphur Dioxide',
  none: 'None (Vacuum)',
  toxic: 'Toxic',
  vacuum: 'Vacuum',
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
  power_plant: 'Power Plant',
  entertainment_complex: 'Entertainment Complex',
  hydroponics_bay: 'Hydroponics Bay',
  orbital_platform: 'Orbital Platform',
  recycling_plant: 'Recycling Plant',
  communications_hub: 'Communications Hub',
  terraforming_station: 'Terraforming Station',
  military_academy: 'Military Academy',
  fusion_reactor: 'Fusion Reactor',
  // ── Vaelori ─────────────────────────────────────────────────────────────
  crystal_resonance_chamber: 'Crystal Resonance Chamber',
  psionic_amplifier: 'Psionic Amplifier',
  // ── Khazari ─────────────────────────────────────────────────────────────
  war_forge: 'War Forge',
  magma_tap: 'Magma Tap',
  // ── Sylvani ─────────────────────────────────────────────────────────────
  living_archive: 'Living Archive',
  growth_vat: 'Growth Vat',
  // ── Nexari ──────────────────────────────────────────────────────────────
  neural_network_hub: 'Neural Network Hub',
  assimilation_node: 'Assimilation Node',
  // ── Drakmari ────────────────────────────────────────────────────────────
  abyssal_processor: 'Abyssal Processor',
  predator_arena: 'Predator Arena',
  // ── Teranos ─────────────────────────────────────────────────────────────
  diplomatic_quarter: 'Diplomatic Quarter',
  innovation_lab: 'Innovation Lab',
  // ── Zorvathi ────────────────────────────────────────────────────────────
  deep_hive: 'Deep Hive',
  tunnel_network: 'Tunnel Network',
  // ── Ashkari ─────────────────────────────────────────────────────────────
  salvage_yard: 'Salvage Yard',
  black_market: 'Black Market',
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

// ── Migration sub-components ──────────────────────────────────────────────────

interface MigrationProgressBarProps {
  arrived: number;
  threshold: number;
}

function MigrationProgressBar({ arrived, threshold }: MigrationProgressBarProps): React.ReactElement {
  const pct = Math.min(100, Math.round((arrived / threshold) * 100));
  return (
    <div className="resource-bar-track migration-progress-track">
      <div
        className="resource-bar-fill migration-progress-fill"
        style={{ width: `${pct}%`, background: '#00d4ff' }}
      />
      <span className="resource-bar-label">{arrived}/{threshold}</span>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

/** Active migration info passed down from App. */
export interface ActiveMigrationInfo {
  /** Colonists that have arrived at the target planet so far. */
  arrivedPopulation: number;
  /** Number of colonists needed to establish the colony. */
  threshold: number;
  /** Game ticks until the next wave departs. */
  ticksToNextWave: number;
  /** Human-readable status label. */
  status: string;
  /** Name of the source planet migrants are drawn from. */
  sourcePlanetName: string;
  /** Colonists lost in transit. */
  colonistsLost: number;
  /** Current wave number. */
  currentWave: number;
}

interface PlanetDetailPanelProps {
  planet: Planet | null;
  onClose?: () => void;
  /** The player's empire (used to determine ownership and colonisation eligibility). */
  playerEmpire?: Empire | null;
  /** Known empires for displaying enemy ownership. */
  knownEmpireMap?: Map<string, { name: string; color: string }>;
  /** System ID for the colonise action. */
  systemId?: string | null;
  /** Active migration targeting this planet, if any. */
  activeMigration?: ActiveMigrationInfo | null;
  /** Called when the player clicks "Cancel Migration". */
  onCancelMigration?: () => void;
  /** Estimated total waves needed (shown in colonise panel). */
  estimatedWaves?: number;
  /** Name of the suggested source planet for migration. */
  sourcePlanetName?: string | null;
  /** Whether the player owns at least one planet in this system (required for in-system colonisation). */
  playerOwnsInSystem?: boolean;
  /** Empire resources for mineral affordability checks. */
  empireResources?: EmpireResources | null;
  /**
   * A coloniser ship belonging to the player that is currently in this system,
   * ready to establish an inter-system colony.  When provided, a
   * "Colonise with Colony Ship" button is shown for unowned planets that meet
   * the habitability threshold.
   */
  coloniserShipInSystem?: Ship | null;
  /** Called when the player clicks "Colonise with Colony Ship". */
  onColoniseWithShip?: (shipId: string) => void;
}

// ── PlanetDetailPanel ─────────────────────────────────────────────────────────

export function PlanetDetailPanel({
  planet,
  onClose,
  playerEmpire,
  knownEmpireMap,
  systemId,
  activeMigration,
  onCancelMigration,
  estimatedWaves = 17,
  sourcePlanetName,
  playerOwnsInSystem = false,
  empireResources = null,
  coloniserShipInSystem = null,
  onColoniseWithShip,
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
    mineralCost: number;
  } | null => {
    if (!planet || !playerEmpire || ownership !== 'unowned') return null;
    const mineralCost = COLONISATION_MINERAL_COST;
    const baseCheck = canColonize(planet, playerEmpire.species);
    if (!baseCheck.allowed) {
      return { allowed: false, reason: baseCheck.reason, cost: BASE_COLONISE_COST, mineralCost };
    }
    if (playerEmpire.credits < BASE_COLONISE_COST) {
      return {
        allowed: false,
        reason: `Insufficient funds (need ${BASE_COLONISE_COST.toLocaleString()} CR, have ${playerEmpire.credits.toLocaleString()} CR)`,
        cost: BASE_COLONISE_COST,
        mineralCost,
      };
    }
    const minerals = empireResources?.minerals ?? 0;
    if (minerals < mineralCost) {
      return {
        allowed: false,
        reason: `Insufficient minerals (need ${mineralCost.toLocaleString()}, have ${minerals.toLocaleString()})`,
        cost: BASE_COLONISE_COST,
        mineralCost,
      };
    }
    return { allowed: true, cost: BASE_COLONISE_COST, mineralCost };
  }, [planet, playerEmpire, ownership, empireResources]);

  // ── Actions ────────────────────────────────────────────────────────────────

  // Emit event to start a migration via SystemViewScene → GameEngine
  const handleStartMigration = useCallback(() => {
    if (!planet || !playerEmpire || !systemId) return;
    const game = (window as unknown as Record<string, unknown>).__EX_NIHILO_GAME__ as
      | { events: { emit: (e: string, d: unknown) => void } }
      | undefined;
    game?.events.emit('colony:start_migration', {
      systemId,
      targetPlanetId: planet.id,
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

  const handleColoniseWithShip = useCallback(() => {
    if (!coloniserShipInSystem || !planet || !playerEmpire) return;
    if (onColoniseWithShip) {
      onColoniseWithShip(coloniserShipInSystem.id);
      return;
    }
    // Fallback: emit directly to Phaser when no callback is provided.
    const game = (window as unknown as Record<string, unknown>).__EX_NIHILO_GAME__ as
      | { events: { emit: (e: string, d: unknown) => void } }
      | undefined;
    game?.events.emit('colony:colonise_with_ship', {
      fleetId: coloniserShipInSystem.fleetId,
      planetId: planet.id,
      empireId: playerEmpire.id,
    });
  }, [coloniserShipInSystem, planet, playerEmpire, systemId, onColoniseWithShip]);

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

          {/* ── Planet Characteristics ── */}
          <div className="panel-divider" />
          <div className="panel-section-label">CHARACTERISTICS</div>

          {planet.size && (
            <div className="panel-row">
              <span className="panel-label">Size</span>
              <span className="panel-value">
                {PLANET_SIZE_LABELS[planet.size] ?? planet.size}
                <span className="panel-value--muted"> ({PLANET_SIZE_SLOTS[planet.size] ?? '?'} slots)</span>
              </span>
            </div>
          )}

          {planet.fertility !== undefined && (
            <div className="panel-row panel-row--column">
              <span className="panel-label">Fertility</span>
              <ResourceBar value={planet.fertility} />
              {planet.fertility <= 20 && (
                <span className="panel-value--muted panel-value--warning" style={{ fontSize: '9px' }}>
                  Low fertility — hydroponics required
                </span>
              )}
            </div>
          )}

          {planet.beauty !== undefined && (
            <div className="panel-row panel-row--column">
              <span className="panel-label">Beauty</span>
              <ResourceBar value={planet.beauty} />
            </div>
          )}

          {/* ── Special Modifiers ── */}
          {planet.modifiers && planet.modifiers.length > 0 && (
            <>
              <div className="panel-divider" />
              <div className="panel-section-label">SPECIAL</div>
              {planet.modifiers.map((mod, idx) => (
                <div key={idx} className="panel-row panel-row--column">
                  <span className={`panel-label panel-modifier panel-modifier--${mod.effect}`}>
                    {mod.effect === 'positive' ? '+' : mod.effect === 'negative' ? '-' : '~'} {mod.label}
                  </span>
                  <span className="panel-value--muted" style={{ fontSize: '9px' }}>
                    {mod.description}
                  </span>
                </div>
              ))}
            </>
          )}

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

          {/* Unowned planet — active migration in progress */}
          {ownership === 'unowned' && playerOwnsInSystem && activeMigration && (
            <>
              <div className="panel-divider" />
              <div className="panel-section-label">MIGRATION IN PROGRESS</div>

              <div className="panel-row">
                <span className="panel-label">Source</span>
                <span className="panel-value">{activeMigration.sourcePlanetName}</span>
              </div>

              <div className="panel-row">
                <span className="panel-label">Wave</span>
                <span className="panel-value">
                  {activeMigration.currentWave}/~{estimatedWaves}
                </span>
              </div>

              <div className="panel-row panel-row--column">
                <span className="panel-label">
                  Colonists Arrived
                </span>
                <MigrationProgressBar
                  arrived={activeMigration.arrivedPopulation}
                  threshold={activeMigration.threshold}
                />
              </div>

              <div className="panel-row">
                <span className="panel-label">Status</span>
                <span className="panel-value panel-value--cyan">
                  Migrating — {activeMigration.arrivedPopulation}/{activeMigration.threshold} colonists
                </span>
              </div>

              <div className="panel-row">
                <span className="panel-label">Next wave</span>
                <span className="panel-value">
                  {activeMigration.ticksToNextWave} turn{activeMigration.ticksToNextWave !== 1 ? 's' : ''}
                </span>
              </div>

              {activeMigration.colonistsLost > 0 && (
                <div className="panel-row">
                  <span className="panel-label">Lost in transit</span>
                  <span className="panel-value panel-value--warning">
                    {activeMigration.colonistsLost} colonists
                  </span>
                </div>
              )}

              <div className="colonise-action">
                <button
                  className="colonise-btn colonise-btn--cancel"
                  onClick={onCancelMigration}
                >
                  Cancel Migration
                </button>
              </div>
            </>
          )}

          {/* Unowned planet — no active migration: show colonise options */}
          {ownership === 'unowned' && playerOwnsInSystem && !activeMigration && (
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
                    <span className="panel-value">{colonisationStatus.cost.toLocaleString()} CR + {colonisationStatus.mineralCost.toLocaleString()} minerals</span>
                  </div>

                  <div className="panel-row">
                    <span className="panel-label">Colonists</span>
                    <span className="panel-value panel-value--muted">
                      25K transferred (1-5% mortality)
                    </span>
                  </div>

                  <div className="panel-row">
                    <span className="panel-label">Duration</span>
                    <span className="panel-value panel-value--muted">
                      ~{estimatedWaves} turns
                    </span>
                  </div>

                  {sourcePlanetName && (
                    <div className="panel-row">
                      <span className="panel-label">Source</span>
                      <span className="panel-value panel-value--muted">
                        {sourcePlanetName}
                      </span>
                    </div>
                  )}

                  {!colonisationStatus.allowed && colonisationStatus.reason && (
                    <div className="colonise-reason">{colonisationStatus.reason}</div>
                  )}

                  <div className="colonise-action">
                    <button
                      className={`colonise-btn${colonisationStatus.allowed ? '' : ' colonise-btn--disabled'}`}
                      onClick={colonisationStatus.allowed ? handleStartMigration : undefined}
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

          {/* Unowned planet — coloniser ship present in this system */}
          {ownership === 'unowned' && !activeMigration && coloniserShipInSystem && (
            <>
              <div className="panel-divider" />
              <div className="panel-section-label">COLONY SHIP</div>

              <div className="panel-row">
                <span className="panel-label">Ship</span>
                <span className="panel-value">{coloniserShipInSystem.name}</span>
              </div>

              {habitabilityReport && (
                <div className="panel-row panel-row--column">
                  <span className="panel-label">Habitability</span>
                  <HabitabilityBar score={habitabilityReport.score} />
                </div>
              )}

              <div className="panel-row">
                <span className="panel-label">Founding population</span>
                <span className="panel-value">500</span>
              </div>

              {habitabilityReport && habitabilityReport.score < 10 && (
                <div className="colonise-reason">
                  Habitability too low to establish a colony (minimum 10).
                </div>
              )}

              <div className="colonise-action">
                <button
                  className={`colonise-btn colonise-btn--ship${habitabilityReport && habitabilityReport.score < 10 ? ' colonise-btn--disabled' : ''}`}
                  onClick={habitabilityReport && habitabilityReport.score >= 10 ? handleColoniseWithShip : undefined}
                  disabled={!!(habitabilityReport && habitabilityReport.score < 10)}
                  aria-disabled={!!(habitabilityReport && habitabilityReport.score < 10)}
                  title="Consume this colony ship to immediately establish a new colony with 500 colonists"
                >
                  Colonise with Colony Ship
                </button>
              </div>
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
                      {' '}({Math.ceil(planet.productionQueue[0]!.turnsRemaining)}t)
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
                    <span className="building-level">{Math.ceil(item.turnsRemaining)}t</span>
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
