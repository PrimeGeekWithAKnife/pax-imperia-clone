import React, { useState, useMemo, useCallback, useRef } from 'react';
import type {
  Empire,
  DiplomaticRelation,
  DiplomaticStatus,
  TreatyType,
  Treaty,
  AIPersonality,
} from '@nova-imperia/shared';
import { RelationshipMeter } from '../components/RelationshipMeter';
import { TreatyCard } from '../components/TreatyCard';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<DiplomaticStatus, string> = {
  unknown:  'Unknown',
  neutral:  'Neutral',
  friendly: 'Friendly',
  allied:   'Allied',
  hostile:  'Hostile',
  at_war:   'At War',
};

const STATUS_CLASSES: Record<DiplomaticStatus, string> = {
  unknown:  'status--unknown',
  neutral:  'status--neutral',
  friendly: 'status--friendly',
  allied:   'status--allied',
  hostile:  'status--hostile',
  at_war:   'status--at-war',
};

const PERSONALITY_LABELS: Record<AIPersonality, string> = {
  aggressive:   'Aggressive Warlord',
  defensive:    'Cautious Defender',
  economic:     'Shrewd Merchant',
  diplomatic:   'Cunning Diplomat',
  expansionist: 'Bold Expansionist',
  researcher:   'Inquisitive Scientist',
};

/** Minimum attitude required to propose each treaty type */
const TREATY_MIN_ATTITUDE: Record<TreatyType, number> = {
  non_aggression:   -30,
  trade:             0,
  research_sharing:  20,
  mutual_defense:    40,
  alliance:          60,
};

const TREATY_LABELS: Record<TreatyType, string> = {
  non_aggression:   'Non-Aggression Pact',
  trade:            'Trade Agreement',
  research_sharing: 'Research Sharing',
  mutual_defense:   'Mutual Defense',
  alliance:         'Alliance',
};

const TREATY_DESCRIPTIONS: Record<TreatyType, string> = {
  non_aggression:   'Prevents either party from starting hostilities. Requires attitude > -30.',
  trade:            'Opens trade routes for mutual credits income. Requires neutral attitude.',
  research_sharing: 'Both empires share technology breakthroughs. Requires friendly attitude.',
  mutual_defense:   'Obligates both empires to defend each other. Requires close friendship.',
  alliance:         'Full partnership: shared vision, coordinated fleets. Requires high trust.',
};

const TREATY_TYPES_ORDERED: TreatyType[] = [
  'non_aggression',
  'trade',
  'research_sharing',
  'mutual_defense',
  'alliance',
];

// ── Sub-types ─────────────────────────────────────────────────────────────────

export interface DiplomaticIncident {
  turn: number;
  description: string;
  kind: 'positive' | 'negative' | 'neutral';
}

export interface KnownEmpire {
  empire: Empire;
  relation: DiplomaticRelation;
  /** Trust 0-100 (separate from attitude) */
  trust: number;
  incidents: DiplomaticIncident[];
  isKnown: boolean;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface DiplomacyScreenProps {
  playerEmpire: Empire;
  knownEmpires: KnownEmpire[];
  currentTurn: number;
  onClose: () => void;
  onProposeTreaty?: (targetEmpireId: string, type: TreatyType) => void;
  onBreakTreaty?: (targetEmpireId: string, treaty: Treaty) => void;
  onDeclareWar?: (targetEmpireId: string) => void;
  onMakePeace?: (targetEmpireId: string) => void;
  onSendGift?: (targetEmpireId: string, credits: number) => void;
  onEstablishTradeRoute?: (targetEmpireId: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSpeciesInitial(speciesName: string): string {
  return speciesName.charAt(0).toUpperCase();
}

/** Generate a deterministic hue from a string ID for unknown/placeholder colours */
function idToHue(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

function getEmpireColor(empire: Empire): string {
  return empire.color || `hsl(${idToHue(empire.id)}, 70%, 50%)`;
}

// ── Relationship Graph node ───────────────────────────────────────────────────

interface GraphNode {
  id: string;
  label: string;
  color: string;
  x: number;
  y: number;
  isPlayer: boolean;
}

interface GraphEdge {
  fromId: string;
  toId: string;
  status: DiplomaticStatus;
  attitude: number;
}

function buildRelationGraph(
  playerEmpire: Empire,
  knownEmpires: KnownEmpire[],
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const known = knownEmpires.filter((ke) => ke.isKnown);
  const cx = 50;
  const cy = 50;
  const r  = 35;

  const nodes: GraphNode[] = [
    {
      id: playerEmpire.id,
      label: playerEmpire.name,
      color: getEmpireColor(playerEmpire),
      x: cx,
      y: cy,
      isPlayer: true,
    },
  ];

  known.forEach((ke, idx) => {
    const angle = (idx / known.length) * Math.PI * 2 - Math.PI / 2;
    nodes.push({
      id: ke.empire.id,
      label: ke.empire.name,
      color: getEmpireColor(ke.empire),
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      isPlayer: false,
    });
  });

  const edges: GraphEdge[] = known.map((ke) => ({
    fromId:   playerEmpire.id,
    toId:     ke.empire.id,
    status:   ke.relation.status,
    attitude: ke.relation.attitude,
  }));

  return { nodes, edges };
}

function edgeColor(status: DiplomaticStatus): string {
  switch (status) {
    case 'allied':   return '#00e676';
    case 'friendly': return '#69f0ae';
    case 'neutral':  return '#78909c';
    case 'hostile':  return '#ff6d00';
    case 'at_war':   return '#f44336';
    default:         return '#455a64';
  }
}

function edgeThickness(attitude: number): number {
  const abs = Math.abs(attitude);
  if (abs >= 80) return 2.5;
  if (abs >= 50) return 1.8;
  if (abs >= 20) return 1.2;
  return 0.7;
}

// ── RelationGraph mini-component ─────────────────────────────────────────────

function RelationGraph({
  playerEmpire,
  knownEmpires,
  selectedId,
  onSelectEmpire,
}: {
  playerEmpire: Empire;
  knownEmpires: KnownEmpire[];
  selectedId: string | null;
  onSelectEmpire: (id: string) => void;
}): React.ReactElement {
  const { nodes, edges } = useMemo(
    () => buildRelationGraph(playerEmpire, knownEmpires),
    [playerEmpire, knownEmpires],
  );

  return (
    <svg
      className="relation-graph"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Edges */}
      {edges.map((edge) => {
        const fromNode = nodes.find((n) => n.id === edge.fromId);
        const toNode   = nodes.find((n) => n.id === edge.toId);
        if (!fromNode || !toNode) return null;
        return (
          <line
            key={`${edge.fromId}-${edge.toId}`}
            x1={fromNode.x}
            y1={fromNode.y}
            x2={toNode.x}
            y2={toNode.y}
            stroke={edgeColor(edge.status)}
            strokeWidth={edgeThickness(edge.attitude)}
            strokeOpacity={0.7}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((node) => {
        const isSelected = node.id === selectedId;
        const nodeR = node.isPlayer ? 5 : 3.5;
        return (
          <g
            key={node.id}
            onClick={() => { if (!node.isPlayer) onSelectEmpire(node.id); }}
            style={{ cursor: node.isPlayer ? 'default' : 'pointer' }}
          >
            <circle
              cx={node.x}
              cy={node.y}
              r={nodeR + (isSelected ? 1 : 0)}
              fill={node.color}
              stroke={isSelected ? '#fff' : 'rgba(255,255,255,0.3)'}
              strokeWidth={isSelected ? 0.8 : 0.4}
              style={{ filter: node.isPlayer ? 'drop-shadow(0 0 2px #fff)' : undefined }}
            />
            <text
              x={node.x}
              y={node.y + nodeR + 3.5}
              fontSize={3}
              fill="rgba(208,232,255,0.85)"
              textAnchor="middle"
              style={{ pointerEvents: 'none', fontFamily: 'monospace' }}
            >
              {node.label.substring(0, 10)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── War confirmation dialog ───────────────────────────────────────────────────

function WarConfirmDialog({
  targetName,
  onConfirm,
  onCancel,
}: {
  targetName: string;
  onConfirm: () => void;
  onCancel: () => void;
}): React.ReactElement {
  return (
    <div className="diplo-dialog-overlay">
      <div className="diplo-dialog">
        <div className="diplo-dialog__title">Declare War</div>
        <div className="diplo-dialog__body">
          Are you sure you want to declare war on <strong>{targetName}</strong>?
          This will immediately end all treaties and alert your allies.
        </div>
        <div className="diplo-dialog__actions">
          <button
            type="button"
            className="diplo-btn diplo-btn--war"
            onClick={onConfirm}
          >
            Declare War
          </button>
          <button
            type="button"
            className="diplo-btn diplo-btn--secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Break treaty confirmation dialog ─────────────────────────────────────────

function BreakTreatyDialog({
  treatyType,
  targetName,
  onConfirm,
  onCancel,
}: {
  treatyType: string;
  targetName: string;
  onConfirm: () => void;
  onCancel: () => void;
}): React.ReactElement {
  return (
    <div className="diplo-dialog-overlay">
      <div className="diplo-dialog">
        <div className="diplo-dialog__title">Break Treaty</div>
        <div className="diplo-dialog__body">
          Break the <strong>{treatyType}</strong> with <strong>{targetName}</strong>?
          This will significantly reduce trust and may worsen relations.
        </div>
        <div className="diplo-dialog__actions">
          <button
            type="button"
            className="diplo-btn diplo-btn--danger"
            onClick={onConfirm}
          >
            Break Treaty
          </button>
          <button
            type="button"
            className="diplo-btn diplo-btn--secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DiplomacyScreen({
  playerEmpire,
  knownEmpires,
  currentTurn,
  onClose,
  onProposeTreaty,
  onBreakTreaty,
  onDeclareWar,
  onMakePeace,
  onSendGift,
  onEstablishTradeRoute,
}: DiplomacyScreenProps): React.ReactElement {
  // ── Local state ──────────────────────────────────────────────────────────
  const [selectedEmpireId, setSelectedEmpireId] = useState<string | null>(
    knownEmpires.length > 0 && knownEmpires[0].isKnown ? knownEmpires[0].empire.id : null,
  );
  const [selectedTreatyType, setSelectedTreatyType] = useState<TreatyType>('non_aggression');
  const [giftAmount, setGiftAmount] = useState<number>(100);
  const [pendingWarTarget, setPendingWarTarget] = useState<string | null>(null);
  const [pendingBreakTreaty, setPendingBreakTreaty] = useState<Treaty | null>(null);
  const incidentLogRef = useRef<HTMLDivElement>(null);

  // ── Derived ──────────────────────────────────────────────────────────────
  const selectedEntry = useMemo(
    () => knownEmpires.find((ke) => ke.empire.id === selectedEmpireId) ?? null,
    [knownEmpires, selectedEmpireId],
  );

  const isAtWar = selectedEntry?.relation.status === 'at_war';

  const canPropose = useMemo((): boolean => {
    if (!selectedEntry) return false;
    if (isAtWar) return false;
    const minAttitude = TREATY_MIN_ATTITUDE[selectedTreatyType];
    return selectedEntry.relation.attitude >= minAttitude;
  }, [selectedEntry, selectedTreatyType, isAtWar]);

  const alreadyHasTreaty = useMemo((): boolean => {
    if (!selectedEntry) return false;
    return selectedEntry.relation.treaties.some((t) => t.type === selectedTreatyType);
  }, [selectedEntry, selectedTreatyType]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSelectEmpire = useCallback((id: string) => {
    setSelectedEmpireId(id);
  }, []);

  const handleProposeTreaty = useCallback(() => {
    if (!selectedEntry || !canPropose || alreadyHasTreaty) return;
    onProposeTreaty?.(selectedEntry.empire.id, selectedTreatyType);
  }, [selectedEntry, canPropose, alreadyHasTreaty, selectedTreatyType, onProposeTreaty]);

  const handleDeclareWar = useCallback(() => {
    if (!selectedEntry) return;
    setPendingWarTarget(selectedEntry.empire.id);
  }, [selectedEntry]);

  const handleConfirmWar = useCallback(() => {
    if (!pendingWarTarget) return;
    onDeclareWar?.(pendingWarTarget);
    setPendingWarTarget(null);
  }, [pendingWarTarget, onDeclareWar]);

  const handleMakePeace = useCallback(() => {
    if (!selectedEntry) return;
    onMakePeace?.(selectedEntry.empire.id);
  }, [selectedEntry, onMakePeace]);

  const handleSendGift = useCallback(() => {
    if (!selectedEntry || giftAmount <= 0) return;
    onSendGift?.(selectedEntry.empire.id, giftAmount);
  }, [selectedEntry, giftAmount, onSendGift]);

  const handleEstablishTrade = useCallback(() => {
    if (!selectedEntry) return;
    onEstablishTradeRoute?.(selectedEntry.empire.id);
  }, [selectedEntry, onEstablishTradeRoute]);

  const handleBreakTreatyRequest = useCallback((treaty: Treaty) => {
    setPendingBreakTreaty(treaty);
  }, []);

  const handleConfirmBreakTreaty = useCallback(() => {
    if (!selectedEntry || !pendingBreakTreaty) return;
    onBreakTreaty?.(selectedEntry.empire.id, pendingBreakTreaty);
    setPendingBreakTreaty(null);
  }, [selectedEntry, pendingBreakTreaty, onBreakTreaty]);

  // ── Portrait helpers ──────────────────────────────────────────────────────

  function renderPortraitSmall(ke: KnownEmpire): React.ReactElement {
    if (!ke.isKnown) {
      return (
        <div className="diplo-portrait diplo-portrait--unknown">
          <span>?</span>
        </div>
      );
    }
    const color = getEmpireColor(ke.empire);
    return (
      <div
        className="diplo-portrait diplo-portrait--small"
        style={{ borderColor: color, background: `${color}22` }}
      >
        <span style={{ color }}>{getSpeciesInitial(ke.empire.species.name)}</span>
      </div>
    );
  }

  function renderPortraitLarge(ke: KnownEmpire): React.ReactElement {
    const color = getEmpireColor(ke.empire);
    return (
      <div
        className="diplo-portrait diplo-portrait--large"
        style={{ borderColor: color, background: `${color}22` }}
      >
        <span style={{ color }}>{getSpeciesInitial(ke.empire.species.name)}</span>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="diplo-screen">

      {/* ── Top Status Bar ─────────────────────────────────────────────── */}
      <div className="diplo-screen__status-bar">
        <div className="diplo-status-bar__left">
          <span className="diplo-status-bar__title">DIPLOMACY</span>
          <span className="diplo-status-bar__empire">{playerEmpire.name}</span>
          <span className="diplo-status-bar__turn">Turn {currentTurn}</span>
          <span className="diplo-status-bar__stat">
            Known Empires: {knownEmpires.filter((ke) => ke.isKnown).length}
          </span>
        </div>
        <div className="diplo-status-bar__right">
          <button
            type="button"
            className="diplo-screen__close-btn"
            onClick={onClose}
          >
            &#10005; Close
          </button>
        </div>
      </div>

      {/* ── Main three-column layout ────────────────────────────────────── */}
      <div className="diplo-screen__main">

        {/* ── Left panel: empire list ──────────────────────────────────── */}
        <div className="diplo-screen__left-panel">
          <div className="diplo-panel-header">KNOWN EMPIRES</div>
          <div className="diplo-empire-list">
            {knownEmpires.length === 0 && (
              <div className="diplo-empire-list__empty">
                No contact with other empires yet.
              </div>
            )}
            {knownEmpires.map((ke) => {
              const isSelected = ke.empire.id === selectedEmpireId;
              return (
                <div
                  key={ke.empire.id}
                  className={`diplo-empire-row ${isSelected ? 'diplo-empire-row--selected' : ''} ${ke.isKnown ? '' : 'diplo-empire-row--unknown'}`}
                  onClick={() => { if (ke.isKnown) handleSelectEmpire(ke.empire.id); }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && ke.isKnown) {
                      handleSelectEmpire(ke.empire.id);
                    }
                  }}
                >
                  {renderPortraitSmall(ke)}
                  <div className="diplo-empire-row__info">
                    <div className="diplo-empire-row__name">
                      {ke.isKnown ? ke.empire.name : '???'}
                    </div>
                    <div className="diplo-empire-row__species">
                      {ke.isKnown ? ke.empire.species.name : 'Unknown Species'}
                    </div>
                  </div>
                  <div className={`diplo-status-badge ${STATUS_CLASSES[ke.relation.status]}`}>
                    {STATUS_LABELS[ke.relation.status]}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Centre panel: selected empire detail ─────────────────────── */}
        <div className="diplo-screen__centre-panel">
          {!selectedEntry ? (
            <div className="diplo-no-selection">
              <div className="diplo-no-selection__text">
                Select an empire from the list to view diplomatic details.
              </div>
            </div>
          ) : (
            <>
              {/* Portrait + identity */}
              <div className="diplo-identity">
                {renderPortraitLarge(selectedEntry)}
                <div className="diplo-identity__info">
                  <div className="diplo-identity__empire-name">{selectedEntry.empire.name}</div>
                  <div className="diplo-identity__species-name">{selectedEntry.empire.species.name}</div>
                  {selectedEntry.empire.aiPersonality && (
                    <div className="diplo-identity__personality">
                      {PERSONALITY_LABELS[selectedEntry.empire.aiPersonality]}
                    </div>
                  )}
                </div>
                <div className={`diplo-status-badge diplo-status-badge--large ${STATUS_CLASSES[selectedEntry.relation.status]}`}>
                  {STATUS_LABELS[selectedEntry.relation.status]}
                </div>
              </div>

              {/* Relationship meters */}
              <div className="diplo-meters">
                <RelationshipMeter
                  label="Attitude"
                  value={selectedEntry.relation.attitude}
                  min={-100}
                  max={100}
                  bidirectional
                />
                <RelationshipMeter
                  label="Trust"
                  value={selectedEntry.trust}
                  min={0}
                  max={100}
                />
              </div>

              {/* Active treaties */}
              <div className="diplo-section">
                <div className="diplo-section__header">ACTIVE TREATIES</div>
                {selectedEntry.relation.treaties.length === 0 ? (
                  <div className="diplo-section__empty">No active treaties.</div>
                ) : (
                  <div className="diplo-treaties-list">
                    {selectedEntry.relation.treaties.map((treaty, idx) => (
                      <TreatyCard
                        key={`${treaty.type}-${idx}`}
                        treaty={treaty}
                        currentTurn={currentTurn}
                        onBreak={handleBreakTreatyRequest}
                        canBreak={!isAtWar}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Incident log */}
              <div className="diplo-section diplo-section--log">
                <div className="diplo-section__header">INCIDENT LOG</div>
                <div className="diplo-incident-log" ref={incidentLogRef}>
                  {selectedEntry.incidents.length === 0 ? (
                    <div className="diplo-section__empty">No recorded incidents.</div>
                  ) : (
                    [...selectedEntry.incidents]
                      .sort((a, b) => b.turn - a.turn)
                      .map((incident, idx) => (
                        <div
                          key={idx}
                          className={`diplo-incident diplo-incident--${incident.kind}`}
                        >
                          <span className="diplo-incident__turn">Turn {incident.turn}</span>
                          <span className="diplo-incident__desc">{incident.description}</span>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Right panel: actions ─────────────────────────────────────── */}
        <div className="diplo-screen__right-panel">
          <div className="diplo-panel-header">DIPLOMATIC ACTIONS</div>

          {!selectedEntry ? (
            <div className="diplo-no-selection diplo-no-selection--small">
              Select an empire to see available actions.
            </div>
          ) : (
            <>
              {/* Propose Treaty */}
              {!isAtWar && (
                <div className="diplo-action-section">
                  <div className="diplo-action-section__title">PROPOSE TREATY</div>
                  <div className="diplo-treaty-selector">
                    {TREATY_TYPES_ORDERED.map((type) => {
                      const minAttr    = TREATY_MIN_ATTITUDE[type];
                      const hasAttitude = selectedEntry.relation.attitude >= minAttr;
                      const alreadyHas  = selectedEntry.relation.treaties.some((t) => t.type === type);
                      const isChosen    = selectedTreatyType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          className={`diplo-treaty-option ${isChosen ? 'diplo-treaty-option--selected' : ''} ${!hasAttitude || alreadyHas ? 'diplo-treaty-option--disabled' : ''}`}
                          onClick={() => setSelectedTreatyType(type)}
                          disabled={false /* allow selection but show state visually */}
                          title={TREATY_DESCRIPTIONS[type]}
                        >
                          <span className="diplo-treaty-option__name">{TREATY_LABELS[type]}</span>
                          {alreadyHas && (
                            <span className="diplo-treaty-option__tag diplo-treaty-option__tag--active">ACTIVE</span>
                          )}
                          {!alreadyHas && !hasAttitude && (
                            <span className="diplo-treaty-option__tag diplo-treaty-option__tag--locked">
                              ATT &gt; {minAttr}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="diplo-treaty-desc">
                    {TREATY_DESCRIPTIONS[selectedTreatyType]}
                  </div>
                  <button
                    type="button"
                    className="diplo-btn diplo-btn--primary diplo-btn--full"
                    onClick={handleProposeTreaty}
                    disabled={!canPropose || alreadyHasTreaty}
                    title={
                      alreadyHasTreaty
                        ? 'This treaty is already active'
                        : !canPropose
                          ? `Requires attitude ≥ ${TREATY_MIN_ATTITUDE[selectedTreatyType]}`
                          : 'Send treaty proposal'
                    }
                  >
                    Send Proposal
                  </button>
                </div>
              )}

              {/* War / Peace */}
              <div className="diplo-action-section">
                <div className="diplo-action-section__title">MILITARY</div>
                {isAtWar ? (
                  <button
                    type="button"
                    className="diplo-btn diplo-btn--peace diplo-btn--full"
                    onClick={handleMakePeace}
                  >
                    Negotiate Peace
                  </button>
                ) : (
                  <button
                    type="button"
                    className="diplo-btn diplo-btn--war diplo-btn--full"
                    onClick={handleDeclareWar}
                  >
                    Declare War
                  </button>
                )}
              </div>

              {/* Gift */}
              {!isAtWar && (
                <div className="diplo-action-section">
                  <div className="diplo-action-section__title">SEND GIFT</div>
                  <div className="diplo-gift-row">
                    <input
                      type="number"
                      className="diplo-gift-input"
                      value={giftAmount}
                      min={10}
                      max={playerEmpire.credits}
                      step={50}
                      onChange={(e) => setGiftAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      aria-label="Gift amount in credits"
                    />
                    <span className="diplo-gift-label">credits</span>
                  </div>
                  <button
                    type="button"
                    className="diplo-btn diplo-btn--secondary diplo-btn--full"
                    onClick={handleSendGift}
                    disabled={giftAmount <= 0 || giftAmount > playerEmpire.credits}
                  >
                    Send Gift
                  </button>
                </div>
              )}

              {/* Trade Route */}
              {!isAtWar && (
                <div className="diplo-action-section">
                  <div className="diplo-action-section__title">TRADE</div>
                  <p className="diplo-action-desc">
                    Trade routes: {selectedEntry.relation.tradeRoutes}
                  </p>
                  <button
                    type="button"
                    className="diplo-btn diplo-btn--secondary diplo-btn--full"
                    onClick={handleEstablishTrade}
                    disabled={selectedEntry.relation.status === 'hostile'}
                  >
                    Establish Trade Route
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Bottom: Galaxy Relations Graph ──────────────────────────────── */}
      <div className="diplo-screen__bottom-panel">
        <div className="diplo-panel-header">GALAXY RELATIONS</div>
        <div className="diplo-graph-container">
          <RelationGraph
            playerEmpire={playerEmpire}
            knownEmpires={knownEmpires}
            selectedId={selectedEmpireId}
            onSelectEmpire={handleSelectEmpire}
          />
          <div className="diplo-graph-legend">
            <span className="diplo-graph-legend__item diplo-graph-legend__item--allied">Allied</span>
            <span className="diplo-graph-legend__item diplo-graph-legend__item--friendly">Friendly</span>
            <span className="diplo-graph-legend__item diplo-graph-legend__item--neutral">Neutral</span>
            <span className="diplo-graph-legend__item diplo-graph-legend__item--hostile">Hostile</span>
            <span className="diplo-graph-legend__item diplo-graph-legend__item--war">At War</span>
          </div>
        </div>
      </div>

      {/* ── War confirmation dialog ──────────────────────────────────────── */}
      {pendingWarTarget && (
        <WarConfirmDialog
          targetName={
            knownEmpires.find((ke) => ke.empire.id === pendingWarTarget)?.empire.name ?? 'Unknown'
          }
          onConfirm={handleConfirmWar}
          onCancel={() => setPendingWarTarget(null)}
        />
      )}

      {/* ── Break treaty dialog ──────────────────────────────────────────── */}
      {pendingBreakTreaty && selectedEntry && (
        <BreakTreatyDialog
          treatyType={TREATY_LABELS[pendingBreakTreaty.type]}
          targetName={selectedEntry.empire.name}
          onConfirm={handleConfirmBreakTreaty}
          onCancel={() => setPendingBreakTreaty(null)}
        />
      )}
    </div>
  );
}
