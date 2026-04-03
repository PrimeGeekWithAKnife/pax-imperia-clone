import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { ShipComponent, ShipDesign, ComponentType, HullClass, CoreSystemRole } from '@nova-imperia/shared';
import { renderShipIcon } from '../../assets/graphics';
import {
  validateDesign,
  calculateDesignStats,
  autoEquipDesign,
  getAvailableComponents,
  TECH_AGES,
  ALL_CORE_SYSTEM_ROLES,
  CORE_SYSTEM_LABELS,
} from '@nova-imperia/shared';
import type { DesignStats } from '@nova-imperia/shared';
import { HULL_TEMPLATES, SHIP_COMPONENTS } from '@nova-imperia/shared-data/ships/index.js';
import { ShipSlotView } from '../components/ShipSlotView';
import type { SlotAssignment } from '../components/ShipSlotView';
import { ShipModel3D } from '../components/ShipModel3D';

// ── Helpers ────────────────────────────────────────────────────────────────────

function generateId(): string {
  return `design_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function emitToPhaser(eventName: string, data: unknown): void {
  const game = (window as unknown as Record<string, unknown>).__EX_NIHILO_GAME__ as
    | { events: { emit: (e: string, d: unknown) => void } }
    | undefined;
  game?.events.emit(eventName, data);
}

/** Check whether a hull's required age is at or below the player's current age. */
function isHullUnlocked(hullRequiredAge: string, currentAge: string): boolean {
  const reqIdx = TECH_AGES.findIndex(a => a.name === hullRequiredAge);
  const curIdx = TECH_AGES.findIndex(a => a.name === currentAge);
  if (reqIdx === -1) return true;  // unknown age = always available
  if (curIdx === -1) return false;
  return reqIdx <= curIdx;
}

// Hull class icons using text characters
const HULL_CLASS_ICON: Record<HullClass, string> = {
  scout:            '>>',
  destroyer:        '>>>',
  transport:        '[]>',
  cruiser:          '==>',
  carrier:          '[##]',
  battleship:       '###>',
  coloniser:        '(O)>',
  dreadnought:      '####>',
  battle_station:   '[####]',
  deep_space_probe: '(.)>',
};

// Human-readable age names for locked hull display
const AGE_DISPLAY: Record<string, string> = {
  nano_atomic:  'Nano-Atomic Age',
  fusion:       'Fusion Age',
  nano_fusion:  'Nano-Fusion Age',
  anti_matter:  'Anti-Matter Age',
  singularity:  'Singularity Age',
};

// Component type display names
const COMP_TYPE_LABEL: Record<ComponentType, string> = {
  weapon_beam:         'Beam Weapon',
  weapon_projectile:   'Projectile',
  weapon_missile:      'Missile',
  weapon_point_defense:'Point Defense',
  fighter_bay:         'Fighter Bay',
  shield:              'Shield',
  armor:               'Armour',
  engine:              'Engine',
  warp_drive:          'Warp Drive',
  sensor:              'Sensor',
  repair_drone:        'Repair Drone',
  special:             'Special',
  life_support:        'Life Support',
  targeting_computer:  'Targeting Computer',
  advanced_sensors:    'Advanced Sensors',
  damage_control:      'Damage Control',
  ecm_suite:           'ECM Suite',
  scanner:             'Scanner',
  power_reactor:       'Power Reactor',
  rcs_thrusters:       'RCS Thrusters',
  temperature_control: 'Temperature Control',
  comms_array:         'Comms Array',
  bio_reclamation:     'Bio Reclamation',
  computer_core:       'Computer Core',
};

/** Core system roles that require crew (skipped for unmanned hulls). */
const CREW_SYSTEM_ROLES: CoreSystemRole[] = ['life_support', 'bio_reclamation', 'comms_array'];

// Key stat name for a component type
function keyStat(component: ShipComponent): string {
  const s = component.stats;
  switch (component.type) {
    case 'weapon_beam':
    case 'weapon_projectile':
    case 'weapon_missile':
    case 'weapon_point_defense':
      return `${s['damage'] ?? 0} dmg`;
    case 'fighter_bay':
      return `${s['fighterCount'] ?? 0}x${s['damage'] ?? 0} dmg`;
    case 'shield':
      return `${s['shieldStrength'] ?? 0} str`;
    case 'armor':
      return `${s['armorRating'] ?? 0} AR`;
    case 'engine':
      return `spd ${s['speed'] ?? 0} / ${s['powerOutput'] ?? 0}pw`;
    case 'warp_drive':
      return `warp ${s['warpSpeed'] ?? 0} / ${s['powerDraw'] ?? 0}pw`;
    case 'sensor':
      return `rng ${s['sensorRange'] ?? 0}`;
    case 'scanner':
      return `scan ${s['scanAccuracy'] ?? 0}%${s['sensorRangeBonus'] ? ` +${s['sensorRangeBonus']} rng` : ''}`;
    case 'repair_drone':
    case 'damage_control':
      return `${s['repairRate'] ?? 0}/turn`;
    case 'targeting_computer':
      return `+${s['accuracyBonus'] ?? 0}% acc`;
    case 'ecm_suite':
      return `+${s['evasionBonus'] ?? 0}% eva`;
    case 'advanced_sensors':
      return `rng ${s['sensorRange'] ?? 0}`;
    case 'life_support':
      return `+${s['moraleRecovery'] ?? 0} morale`;
    case 'special':
      return `cost ${component.cost}`;
    case 'power_reactor':
      return `+${s['powerOutput'] ?? 0} pw`;
    case 'rcs_thrusters':
      return `+${s['evasionBonus'] ?? 0}% eva`;
    case 'temperature_control':
      return `${s['heatDissipation'] ?? 0} heat`;
    case 'comms_array':
      return `rng ${s['signalRange'] ?? 0}`;
    case 'bio_reclamation':
      return `+${s['supplyBonus'] ?? 0} supply`;
    case 'computer_core':
      return `+${s['accuracyBonus'] ?? 0}% acc`;
  }
}

// ── Hull icon with text fallback ───────────────────────────────────────────────

interface HullIconProps {
  hullClass: HullClass;
}

/**
 * Renders the ship icon produced by `renderShipIcon`.
 * Falls back to the ASCII text representation when the data URI is empty
 * (stub not yet replaced) or the image fails to load.
 */
function HullIcon({ hullClass }: HullIconProps): React.ReactElement {
  const src = renderShipIcon(hullClass, 64);
  const [imgFailed, setImgFailed] = useState(false);

  if (!src || imgFailed) {
    return <span className="sd-hull-icon-text">{HULL_CLASS_ICON[hullClass]}</span>;
  }

  return (
    <img
      src={src}
      alt={hullClass}
      className="sd-hull-icon-img"
      width={64}
      height={64}
      onError={() => setImgFailed(true)}
    />
  );
}

/**
 * Smaller ship icon (32 px) used in the saved-designs strip at the bottom.
 * Falls back to the ASCII text representation on failure.
 */
function SavedDesignIcon({ hullClass }: HullIconProps): React.ReactElement {
  const src = renderShipIcon(hullClass, 32);
  const [imgFailed, setImgFailed] = useState(false);

  if (!src || imgFailed) {
    return <>{HULL_CLASS_ICON[hullClass]}</>;
  }

  return (
    <img
      src={src}
      alt={hullClass}
      className="sd-saved-item-icon-img"
      width={32}
      height={32}
      onError={() => setImgFailed(true)}
    />
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

export interface ShipDesignerScreenProps {
  researchedTechs: string[];
  currentAge: string;
  empireId: string;
  savedDesigns: ShipDesign[];
  onSaveDesign: (design: ShipDesign) => void;
  onDeleteDesign?: (designId: string) => void;
  onClose: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ShipDesignerScreen({
  researchedTechs,
  currentAge,
  empireId,
  savedDesigns,
  onSaveDesign,
  onDeleteDesign,
  onClose,
}: ShipDesignerScreenProps): React.ReactElement {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); e.preventDefault(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // ── Hull selection ──────────────────────────────────────────────────────────
  const [selectedHullClass, setSelectedHullClass] = useState<HullClass>('scout');

  // ── Current working design ──────────────────────────────────────────────────
  const [designName, setDesignName] = useState('New Design');
  const [assignments, setAssignments] = useState<SlotAssignment[]>([]);
  const [armourPlating, setArmourPlating] = useState(0);

  // ── Core system overrides ───────────────────────────────────────────────────
  const [coreSystemOverrides, setCoreSystemOverrides] = useState<
    Array<{ role: CoreSystemRole; componentId: string }>
  >([]);

  // ── Slot/component picker state ─────────────────────────────────────────────
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // ── 3D model state ──────────────────────────────────────────────────────────
  const [highlightWeaponSlotId, setHighlightWeaponSlotId] = useState<string | null>(null);
  const [showArcs, setShowArcs] = useState(false);

  // ── Comparison design ───────────────────────────────────────────────────────
  const [compareDesignId, setCompareDesignId] = useState<string | null>(null);

  // ── Error/save state ────────────────────────────────────────────────────────
  const [saveFlash, setSaveFlash] = useState<'saved' | 'error' | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Derived data ────────────────────────────────────────────────────────────

  const hull = useMemo(
    () => HULL_TEMPLATES.find((h) => h.class === selectedHullClass) ?? HULL_TEMPLATES[0]!,
    [selectedHullClass],
  );

  const availableComponents = useMemo(
    () => getAvailableComponents(SHIP_COMPONENTS, researchedTechs),
    [researchedTechs],
  );

  const currentDesign = useMemo<ShipDesign>(
    () => ({
      id: generateId(),
      name: designName,
      hull: hull.class,
      components: assignments,
      totalCost: 0,
      empireId,
      armourPlating,
      coreSystemOverrides: coreSystemOverrides.length > 0 ? coreSystemOverrides : undefined,
    }),
    [designName, hull.class, assignments, empireId, armourPlating, coreSystemOverrides],
  );

  const validationResult = useMemo(
    () => validateDesign(currentDesign, hull, SHIP_COMPONENTS),
    [currentDesign, hull],
  );

  const designStats = useMemo(
    () => calculateDesignStats(currentDesign, hull, SHIP_COMPONENTS),
    [currentDesign, hull],
  );

  // Build the 3D model's component array from current hull and assignments
  const model3DComponents = useMemo(() => {
    return hull.slotLayout.map((slot) => {
      const assignment = assignments.find((a) => a.slotId === slot.id);
      const component = assignment
        ? SHIP_COMPONENTS.find((c) => c.id === assignment.componentId) ?? null
        : null;
      return { slot, component };
    });
  }, [hull.slotLayout, assignments]);

  // Slot that is currently selected (for picker)
  const selectedSlot = useMemo(
    () => (selectedSlotId ? hull.slotLayout.find((s) => s.id === selectedSlotId) : null),
    [selectedSlotId, hull.slotLayout],
  );

  // Components that fit the selected slot
  const pickerComponents = useMemo(() => {
    if (!selectedSlot) return [];
    return SHIP_COMPONENTS.map((c) => ({
      component: c,
      unlocked: researchedTechs.includes(c.requiredTech ?? '') || c.requiredTech === null,
      fits: (selectedSlot.allowedTypes as ComponentType[]).includes(c.type),
    })).filter((e) => e.fits);
  }, [selectedSlot, researchedTechs]);

  // Comparison design stats
  const compareDesign = useMemo(
    () => compareDesignId ? savedDesigns.find((d) => d.id === compareDesignId) : null,
    [compareDesignId, savedDesigns],
  );

  const compareStats = useMemo((): DesignStats | null => {
    if (!compareDesign) return null;
    const compareHull = HULL_TEMPLATES.find((h) => h.class === compareDesign.hull);
    if (!compareHull) return null;
    return calculateDesignStats(compareDesign, compareHull, SHIP_COMPONENTS);
  }, [compareDesign]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleHullSelect = useCallback((hullClass: HullClass) => {
    setSelectedHullClass(hullClass);
    setAssignments([]);
    setArmourPlating(0);
    setCoreSystemOverrides([]);
    setSelectedSlotId(null);
    setPickerOpen(false);
  }, []);

  const handleCoreSystemChange = useCallback((role: CoreSystemRole, componentId: string) => {
    setCoreSystemOverrides((prev) => {
      const filtered = prev.filter((o) => o.role !== role);
      if (!componentId) return filtered; // empty = reset to Mk I baseline
      return [...filtered, { role, componentId }];
    });
  }, []);

  const handleSlotClick = useCallback((slotId: string) => {
    setSelectedSlotId(slotId);
    setPickerOpen(true);
  }, []);

  const handleComponentPick = useCallback(
    (componentId: string) => {
      if (!selectedSlotId) return;
      setAssignments((prev) => {
        const filtered = prev.filter((a) => a.slotId !== selectedSlotId);
        return [...filtered, { slotId: selectedSlotId, componentId }];
      });
      setPickerOpen(false);
      setSelectedSlotId(null);
    },
    [selectedSlotId],
  );

  const handleRemoveFromSlot = useCallback(() => {
    if (!selectedSlotId) return;
    setAssignments((prev) => prev.filter((a) => a.slotId !== selectedSlotId));
    setPickerOpen(false);
    setSelectedSlotId(null);
  }, [selectedSlotId]);

  const handleClosePicker = useCallback(() => {
    setPickerOpen(false);
    setSelectedSlotId(null);
  }, []);

  const handleAutoEquip = useCallback(() => {
    const auto = autoEquipDesign(hull, availableComponents);
    setAssignments(auto.components);
    setDesignName(`Auto-${hull.name}`);
  }, [hull, availableComponents]);

  const handleClearAll = useCallback(() => {
    setAssignments([]);
    setSelectedSlotId(null);
    setPickerOpen(false);
  }, []);

  const handleSaveDesign = useCallback(() => {
    if (!validationResult.valid) {
      setSaveFlash('error');
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => setSaveFlash(null), 2000);
      return;
    }
    const saved: ShipDesign = {
      ...currentDesign,
      id: generateId(),
      totalCost: designStats.cost,
    };
    onSaveDesign(saved);
    emitToPhaser('ship:design_saved', saved);
    setSaveFlash('saved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveFlash(null), 2000);
  }, [currentDesign, designStats.cost, onSaveDesign, validationResult.valid]);

  const handleLoadDesign = useCallback(
    (design: ShipDesign) => {
      const loadedHull = HULL_TEMPLATES.find((h) => h.class === design.hull);
      if (!loadedHull) return;
      setSelectedHullClass(design.hull);
      setDesignName(design.name);
      setAssignments(design.components);
      setArmourPlating(design.armourPlating ?? 0);
      setCoreSystemOverrides(design.coreSystemOverrides ?? []);
      setSelectedSlotId(null);
      setPickerOpen(false);
    },
    [],
  );

  // Currently assigned component for selected slot (for showing remove button)
  const slotHasComponent = selectedSlotId
    ? assignments.some((a) => a.slotId === selectedSlotId)
    : false;

  return (
    <div className="ship-designer-overlay">
      <div className="ship-designer">
        {/* Header */}
        <div className="ship-designer__header">
          <div className="ship-designer__title">SHIP DESIGNER</div>
          <div className="ship-designer__subtitle">
            Design and configure ships for your empire
          </div>
          <button
            type="button"
            className="panel-close-btn ship-designer__close"
            onClick={onClose}
            aria-label="Close ship designer"
          >
            ×
          </button>
        </div>

        {/* Main three-column body */}
        <div className="ship-designer__body">
          {/* ── LEFT: Hull Selection + Core Systems ──────────────────── */}
          <div className="ship-designer__left">
            <div className="sd-col-label">HULL CLASS</div>

            {/* Large hull icon */}
            <div className="sd-hull-icon-large">
              {(() => {
                const iconSrc = renderShipIcon(selectedHullClass, 96);
                if (iconSrc) {
                  return <img src={iconSrc} alt={hull.name} width={96} height={96} />;
                }
                return <span className="sd-hull-icon-text-lg">{HULL_CLASS_ICON[selectedHullClass]}</span>;
              })()}
            </div>

            {/* Hull dropdown */}
            <select
              className="sd-hull-dropdown"
              value={selectedHullClass}
              onChange={(e) => {
                const hc = e.target.value as HullClass;
                if (isHullUnlocked(HULL_TEMPLATES.find(h => h.class === hc)?.requiredAge ?? '', currentAge)) {
                  handleHullSelect(hc);
                }
              }}
            >
              <optgroup label="Available">
                {HULL_TEMPLATES.filter(h => isHullUnlocked(h.requiredAge, currentAge)).map(h => (
                  <option key={h.class} value={h.class}>
                    {h.name} (W:{h.slotLayout.filter(s => s.category === 'weapon').length} D:{h.slotLayout.filter(s => s.category === 'defence').length} I:{h.slotLayout.filter(s => s.category === 'internal').length})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Locked">
                {HULL_TEMPLATES.filter(h => !isHullUnlocked(h.requiredAge, currentAge)).map(h => (
                  <option key={h.class} value={h.class} disabled>
                    {h.name} — {AGE_DISPLAY[h.requiredAge] ?? h.requiredAge}
                  </option>
                ))}
              </optgroup>
            </select>

            {/* Hull summary */}
            <div className="sd-hull-summary">
              <div className="sd-hull-summary-item">
                <span className="sd-hull-summary-label">HP</span>
                <span className="sd-hull-summary-value">{hull.baseHullPoints}</span>
              </div>
              <div className="sd-hull-summary-item">
                <span className="sd-hull-summary-label">Cost</span>
                <span className="sd-hull-summary-value">{hull.baseCost}cr</span>
              </div>
              <div className="sd-hull-summary-item">
                <span className="sd-hull-summary-label">W/D/I</span>
                <span className="sd-hull-summary-value">
                  {hull.slotLayout.filter(s => s.category === 'weapon').length}/
                  {hull.slotLayout.filter(s => s.category === 'defence').length}/
                  {hull.slotLayout.filter(s => s.category === 'internal').length}
                </span>
              </div>
              <div className="sd-hull-summary-item">
                <span className="sd-hull-summary-label">Crew</span>
                <span className="sd-hull-summary-value">{hull.baseCrew ?? 0}</span>
              </div>
              <div className="sd-hull-summary-item">
                <span className="sd-hull-summary-label">Supply</span>
                <span className="sd-hull-summary-value">{hull.baseSupplyCapacity ?? 15}t</span>
              </div>
              <div className="sd-hull-summary-item">
                <span className="sd-hull-summary-label">Speed</span>
                <span className="sd-hull-summary-value">{hull.baseSpeed}</span>
              </div>
            </div>

            {/* Core systems */}
            <div className="sd-core-systems">
              <div className="sd-core-systems-title">CORE SYSTEMS</div>
              {hull.manned === false ? (
                <div className="sd-core-unmanned-msg">
                  UNMANNED — no crew systems required
                </div>
              ) : (
                ALL_CORE_SYSTEM_ROLES
                  .filter(role => hull.manned !== false || !CREW_SYSTEM_ROLES.includes(role))
                  .map((role) => {
                    // Find all core system components for this role
                    const roleComponents = SHIP_COMPONENTS
                      .filter(c => c.coreSystemRole === role)
                      .sort((a, b) => a.cost - b.cost);

                    // Current override for this role
                    const override = coreSystemOverrides.find(o => o.role === role);
                    const currentComp = override
                      ? roleComponents.find(c => c.id === override.componentId)
                      : roleComponents[0]; // Mk I baseline

                    // Filter tiers by age
                    const availableTiers = roleComponents.filter(c => {
                      if (!c.minAge) return true;
                      return isHullUnlocked(c.minAge, currentAge);
                    });

                    return (
                      <div key={role} className="sd-core-system-row">
                        <span className="sd-core-system-name" title={CORE_SYSTEM_LABELS[role]}>
                          {CORE_SYSTEM_LABELS[role]}
                        </span>
                        <select
                          className="sd-core-system-select"
                          value={override?.componentId ?? ''}
                          onChange={(e) => handleCoreSystemChange(role, e.target.value)}
                          title={currentComp?.name ?? 'Mk I'}
                        >
                          <option value="">Mk I</option>
                          {roleComponents.slice(1).map(c => {
                            const available = availableTiers.includes(c);
                            const tierLabel = c.name.includes('Mk III') || c.name.includes('Mk3')
                              ? 'Mk III'
                              : c.name.includes('Mk II') || c.name.includes('Mk2')
                                ? 'Mk II'
                                : c.name.split(' ').slice(-1)[0] ?? c.name;
                            return (
                              <option
                                key={c.id}
                                value={c.id}
                                disabled={!available}
                              >
                                {tierLabel} ({c.cost}cr){!available ? ` — ${AGE_DISPLAY[c.minAge ?? ''] ?? c.minAge}` : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          {/* ── CENTER: 3D Model + Slot Layout ─────────────────────────── */}
          <div className="ship-designer__center">
            <div className="sd-col-label">
              {hull.name.toUpperCase()} — SLOT LAYOUT
              <span className="sd-col-label-hint">
                {assignments.length}/{hull.maxSlots} filled
              </span>
            </div>

            {/* 3D ship model preview */}
            <div className="sd-model-3d-wrap" style={{ flexShrink: 0, marginBottom: 8 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}>
                <span style={{
                  fontSize: 9,
                  letterSpacing: '0.1em',
                  color: 'var(--color-accent)',
                  opacity: 0.7,
                  textTransform: 'uppercase',
                }}>
                  3D Preview
                </span>
                <button
                  type="button"
                  onClick={() => setShowArcs((v) => !v)}
                  style={{
                    fontSize: 9,
                    padding: '2px 8px',
                    background: showArcs
                      ? 'rgba(0, 212, 255, 0.12)'
                      : 'rgba(10, 10, 26, 0.6)',
                    border: `1px solid ${showArcs ? 'rgba(0, 212, 255, 0.4)' : 'rgba(0, 180, 220, 0.2)'}`,
                    borderRadius: 4,
                    color: showArcs ? 'var(--color-accent)' : '#6688aa',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {showArcs ? 'Hide arcs' : 'Show arcs'}
                </button>
              </div>
              <ShipModel3D
                hullClass={selectedHullClass}
                components={model3DComponents}
                highlightWeaponSlotId={highlightWeaponSlotId}
                showArcs={showArcs}
                height={280}
                coreSystemOverrides={coreSystemOverrides}
              />
            </div>

            <div className="sd-slot-area">
              <ShipSlotView
                hull={hull}
                assignments={assignments}
                components={SHIP_COMPONENTS}
                selectedSlotId={selectedSlotId}
                onSlotClick={handleSlotClick}
                onSlotHover={setHighlightWeaponSlotId}
              />
            </div>

            {/* Component Picker (shown below when slot is selected) */}
            {pickerOpen && selectedSlot && (
              <div className="sd-picker">
                <div className="sd-picker__header">
                  <span className="sd-picker__title">
                    Slot: {selectedSlot.id} [{selectedSlot.size}]
                  </span>
                  <button
                    type="button"
                    className="panel-close-btn"
                    onClick={handleClosePicker}
                  >
                    ×
                  </button>
                </div>
                <div className="sd-picker__accepts">
                  Accepts: {selectedSlot.allowedTypes.join(', ')}
                </div>

                {slotHasComponent && (
                  <button
                    type="button"
                    className="sd-picker__remove-btn"
                    onClick={handleRemoveFromSlot}
                  >
                    Remove Component
                  </button>
                )}

                <div className="sd-picker__list">
                  {pickerComponents.length === 0 ? (
                    <div className="sd-picker__empty">No matching components</div>
                  ) : (
                    pickerComponents.map(({ component, unlocked }) => {
                      const isEquipped = assignments.some(
                        (a) => a.slotId === selectedSlotId && a.componentId === component.id,
                      );
                      return (
                        <button
                          key={component.id}
                          type="button"
                          className={`sd-picker__item ${!unlocked ? 'sd-picker__item--locked' : ''} ${isEquipped ? 'sd-picker__item--equipped' : ''}`}
                          onClick={() => unlocked && handleComponentPick(component.id)}
                          disabled={!unlocked}
                          title={!unlocked ? `Requires tech: ${component.requiredTech}` : component.name}
                        >
                          <div className="sd-picker__item-left">
                            <span className="sd-picker__item-type">
                              {COMP_TYPE_LABEL[component.type]}
                            </span>
                            <span className="sd-picker__item-name">{component.name}</span>
                            {!unlocked && (
                              <span className="sd-picker__item-locked">
                                Locked: {component.requiredTech}
                              </span>
                            )}
                          </div>
                          <div className="sd-picker__item-right">
                            <span className="sd-picker__item-stat">{keyStat(component)}</span>
                            <span className="sd-picker__item-cost">{component.cost}cr</span>
                          </div>
                          {isEquipped && (
                            <span className="sd-picker__item-equipped-mark">Equipped</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Design Stats ────────────────────────────────────── */}
          <div className="ship-designer__right">
            <div className="sd-col-label">DESIGN STATS</div>

            {/* Name field */}
            <div className="sd-stats-name-row">
              <label className="sd-stats-label" htmlFor="design-name">Design Name</label>
              <input
                id="design-name"
                className="sd-stats-name-input"
                type="text"
                value={designName}
                onChange={(e) => setDesignName(e.target.value)}
                maxLength={40}
                placeholder="Enter design name..."
              />
            </div>

            {/* Hull info */}
            <div className="sd-stats-section">
              <div className="sd-stats-section-label">HULL</div>
              <div className="sd-stat-row">
                <span className="sd-stat-label">Class</span>
                <span className="sd-stat-value">{hull.name}</span>
              </div>
              <div className="sd-stat-row">
                <span className="sd-stat-label">Base HP</span>
                <span className="sd-stat-value">{hull.baseHullPoints}</span>
              </div>
              <div className="sd-stat-row">
                <span className="sd-stat-label">Effective HP</span>
                <span className="sd-stat-value" style={{ color: 'var(--color-accent)' }}>{designStats.effectiveHullPoints}</span>
              </div>
              <div className="sd-stat-row">
                <span className="sd-stat-label">Slots</span>
                <span className="sd-stat-value">
                  {assignments.length}/{hull.maxSlots}
                </span>
              </div>
              {hull.hangarSlots && (
                <div className="sd-stat-row">
                  <span className="sd-stat-label">Hangar ({hull.hangarSlots.count} bays)</span>
                  <span className="sd-stat-value" style={{ fontSize: 9 }}>
                    {hull.hangarSlots.carries.map(c => `${c.quantity}x ${c.hull}`).join(' or ')}
                  </span>
                </div>
              )}
              {!hull.slotLayout.some(s => s.category === 'warp_drive') && (
                <div className="sd-stat-row">
                  <span className="sd-stat-label" style={{ color: '#ff8844' }}>No Warp Drive</span>
                  <span className="sd-stat-value" style={{ color: '#ff8844', fontSize: 9 }}>System-local only</span>
                </div>
              )}
            </div>

            {/* Armour plating slider */}
            <div className="sd-stats-section">
              <div className="sd-stats-section-label">ARMOUR PLATING</div>
              <div className="sd-stat-row">
                <span className="sd-stat-label">Level</span>
                <span className="sd-stat-value">{Math.round(armourPlating * 100)}%</span>
              </div>
              <div style={{ padding: '4px 0 8px' }}>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(armourPlating * 100)}
                  onChange={(e) => setArmourPlating(Number(e.target.value) / 100)}
                  style={{ width: '100%', accentColor: 'var(--color-accent)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--color-text-muted)' }}>
                  <span>None (1x cost)</span>
                  <span>Max (4x cost, 3x HP)</span>
                </div>
              </div>
            </div>

            {/* ── OFFENCE ─────────────────────────────────────────── */}
            <div className="sd-stats-section">
              <div className="sd-stats-section-label">OFFENCE</div>
              {(
                [
                  { label: 'Total Damage',   value: designStats.totalDamage,   compare: compareStats?.totalDamage,   unit: 'dmg' },
                  { label: 'Accuracy Bonus', value: designStats.accuracyBonus, compare: compareStats?.accuracyBonus, unit: '%'   },
                ] as const
              ).map(({ label, value, compare, unit }) => {
                const hasCompare = compare !== undefined && compare !== null;
                const max = hasCompare ? Math.max(value, compare, 1) : Math.max(value, 1);
                const pct = (value / max) * 100;
                const cmpPct = hasCompare ? ((compare ?? 0) / max) * 100 : 0;
                const diff = hasCompare ? value - (compare ?? 0) : 0;
                return (
                  <div key={label} className="sd-stat-bar-row">
                    <div className="sd-stat-bar-header">
                      <span className="sd-stat-label">{label}</span>
                      <div className="sd-stat-bar-values">
                        <span className="sd-stat-value">{value}{unit}</span>
                        {hasCompare && (
                          <span className={`sd-stat-diff ${diff > 0 ? 'sd-stat-diff--pos' : diff < 0 ? 'sd-stat-diff--neg' : ''}`}>
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="sd-stat-bar-track">
                      <div className="sd-stat-bar-fill" style={{ width: `${pct}%` }} />
                      {hasCompare && <div className="sd-stat-bar-compare" style={{ width: `${cmpPct}%` }} />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── DEFENCE ─────────────────────────────────────────── */}
            <div className="sd-stats-section">
              <div className="sd-stats-section-label">DEFENCE</div>
              {(
                [
                  { label: 'Shield Strength',value: designStats.totalShields,       compare: compareStats?.totalShields,       unit: 'str' },
                  { label: 'Armour Rating',  value: designStats.totalArmor,         compare: compareStats?.totalArmor,         unit: 'AR'  },
                  { label: 'Evasion Bonus',  value: designStats.evasionBonus,       compare: compareStats?.evasionBonus,       unit: '%'   },
                  { label: 'Effective HP',   value: designStats.effectiveHullPoints, compare: compareStats?.effectiveHullPoints, unit: ''    },
                ] as const
              ).map(({ label, value, compare, unit }) => {
                const hasCompare = compare !== undefined && compare !== null;
                const max = hasCompare ? Math.max(value, compare, 1) : Math.max(value, 1);
                const pct = (value / max) * 100;
                const cmpPct = hasCompare ? ((compare ?? 0) / max) * 100 : 0;
                const diff = hasCompare ? value - (compare ?? 0) : 0;
                return (
                  <div key={label} className="sd-stat-bar-row">
                    <div className="sd-stat-bar-header">
                      <span className="sd-stat-label">{label}</span>
                      <div className="sd-stat-bar-values">
                        <span className="sd-stat-value">{value}{unit}</span>
                        {hasCompare && (
                          <span className={`sd-stat-diff ${diff > 0 ? 'sd-stat-diff--pos' : diff < 0 ? 'sd-stat-diff--neg' : ''}`}>
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="sd-stat-bar-track">
                      <div className="sd-stat-bar-fill" style={{ width: `${pct}%` }} />
                      {hasCompare && <div className="sd-stat-bar-compare" style={{ width: `${cmpPct}%` }} />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── MOBILITY ────────────────────────────────────────── */}
            <div className="sd-stats-section">
              <div className="sd-stats-section-label">MOBILITY</div>
              {(
                [
                  { label: 'Speed',        value: designStats.speed,       compare: compareStats?.speed,       unit: '' },
                  { label: 'Sensor Range', value: designStats.sensorRange, compare: compareStats?.sensorRange, unit: '' },
                ] as const
              ).map(({ label, value, compare, unit }) => {
                const hasCompare = compare !== undefined && compare !== null;
                const max = hasCompare ? Math.max(value, compare, 1) : Math.max(value, 1);
                const pct = (value / max) * 100;
                const cmpPct = hasCompare ? ((compare ?? 0) / max) * 100 : 0;
                const diff = hasCompare ? value - (compare ?? 0) : 0;
                return (
                  <div key={label} className="sd-stat-bar-row">
                    <div className="sd-stat-bar-header">
                      <span className="sd-stat-label">{label}</span>
                      <div className="sd-stat-bar-values">
                        <span className="sd-stat-value">{value}{unit}</span>
                        {hasCompare && (
                          <span className={`sd-stat-diff ${diff > 0 ? 'sd-stat-diff--pos' : diff < 0 ? 'sd-stat-diff--neg' : ''}`}>
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="sd-stat-bar-track">
                      <div className="sd-stat-bar-fill" style={{ width: `${pct}%` }} />
                      {hasCompare && <div className="sd-stat-bar-compare" style={{ width: `${cmpPct}%` }} />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── LOGISTICS ───────────────────────────────────────── */}
            <div className="sd-stats-section">
              <div className="sd-stats-section-label">LOGISTICS</div>
              <div className="sd-stat-row">
                <span className="sd-stat-label">Crew</span>
                <span className="sd-stat-value">{designStats.crewCount}</span>
              </div>
              <div className="sd-stat-row">
                <span className="sd-stat-label">Supply Capacity</span>
                <span className="sd-stat-value">{designStats.supplyCapacity}t</span>
              </div>
              <div className="sd-stat-row">
                <span className="sd-stat-label">Mass</span>
                <span className="sd-stat-value">{designStats.mass}</span>
              </div>
              <div className="sd-stat-row">
                <span className="sd-stat-label">Power Output</span>
                <span className="sd-stat-value">{designStats.powerOutput}</span>
              </div>
              {designStats.powerBuffer > 0 && (
                <div className="sd-stat-row">
                  <span className="sd-stat-label">Battery Buffer</span>
                  <span className="sd-stat-value">+{designStats.powerBuffer}</span>
                </div>
              )}
              <div className="sd-stat-row">
                <span className="sd-stat-label">Power Draw</span>
                <span className="sd-stat-value">-{designStats.powerDraw}</span>
              </div>
              <div className="sd-stat-row sd-stat-row--total">
                <span className="sd-stat-label">Balance</span>
                <span className="sd-stat-value" style={{
                  color: designStats.powerBalance >= 0 ? '#44ff88' : '#ff4444',
                }}>
                  {designStats.powerBalance >= 0 ? '+' : ''}{designStats.powerBalance}
                </span>
              </div>
            </div>

            {/* Cost breakdown */}
            <div className="sd-stats-section">
              <div className="sd-stats-section-label">COST</div>
              <div className="sd-stat-row">
                <span className="sd-stat-label">Hull base cost</span>
                <span className="sd-stat-value">{hull.baseCost}cr</span>
              </div>
              {assignments.map((a) => {
                const comp = SHIP_COMPONENTS.find((c) => c.id === a.componentId);
                if (!comp) return null;
                return (
                  <div key={a.slotId} className="sd-stat-row sd-stat-row--component">
                    <span className="sd-stat-label">{comp.name}</span>
                    <span className="sd-stat-value">{comp.cost}cr</span>
                  </div>
                );
              })}
              <div className="sd-stat-row sd-stat-row--total">
                <span className="sd-stat-label">TOTAL</span>
                <span className="sd-stat-value sd-stat-value--total">{designStats.cost}cr</span>
              </div>
            </div>

            {/* Validation */}
            <div className="sd-stats-section">
              <div className="sd-stats-section-label">VALIDATION</div>
              <div className={`sd-validation ${validationResult.valid ? 'sd-validation--ok' : 'sd-validation--err'}`}>
                <span className="sd-validation-icon">
                  {validationResult.valid ? 'OK' : 'ERR'}
                </span>
                <span className="sd-validation-text">
                  {validationResult.valid
                    ? 'Design is valid'
                    : `${validationResult.errors.length} error${validationResult.errors.length !== 1 ? 's' : ''}`}
                </span>
              </div>
              {!validationResult.valid && (
                <ul className="sd-validation-errors">
                  {validationResult.errors.map((e, i) => (
                    <li key={i} className="sd-validation-error">{e}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Comparison selector */}
            {savedDesigns.length > 0 && (
              <div className="sd-stats-section">
                <div className="sd-stats-section-label">COMPARE WITH</div>
                <select
                  className="sd-compare-select"
                  value={compareDesignId ?? ''}
                  onChange={(e) => setCompareDesignId(e.target.value || null)}
                >
                  <option value="">-- None --</option>
                  {savedDesigns.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Action buttons */}
            <div className="sd-action-buttons">
              <button
                type="button"
                className="sd-btn sd-btn--secondary"
                onClick={handleAutoEquip}
                title="Auto-fill all slots with best available components"
              >
                Auto-Equip
              </button>
              <button
                type="button"
                className="sd-btn sd-btn--ghost"
                onClick={handleClearAll}
              >
                Clear All
              </button>
              <button
                type="button"
                className={`sd-btn sd-btn--primary ${!validationResult.valid ? 'sd-btn--disabled' : ''} ${saveFlash === 'saved' ? 'sd-btn--saved' : ''} ${saveFlash === 'error' ? 'sd-btn--error' : ''}`}
                onClick={handleSaveDesign}
                title={!validationResult.valid ? 'Fix validation errors before saving' : 'Save this design'}
              >
                {saveFlash === 'saved' ? 'Saved!' : saveFlash === 'error' ? 'Fix Errors' : 'Save Design'}
              </button>
            </div>
          </div>
        </div>

        {/* Bottom: Saved Designs */}
        {savedDesigns.length > 0 && (
          <div className="ship-designer__saved">
            <div className="sd-saved-label">SAVED DESIGNS</div>
            <div className="sd-saved-list">
              {savedDesigns.map((d) => {
                const dHull = HULL_TEMPLATES.find((h) => h.class === d.hull);
                return (
                  <div key={d.id} className="sd-saved-item-wrapper" style={{ position: 'relative', display: 'inline-flex' }}>
                    <button
                      type="button"
                      className="sd-saved-item"
                      onClick={() => handleLoadDesign(d)}
                      title={`Load design: ${d.name}`}
                    >
                      <span className="sd-saved-item-icon">
                        {dHull ? <SavedDesignIcon hullClass={dHull.class} /> : '?'}
                      </span>
                      <span className="sd-saved-item-name">{d.name}</span>
                      <span className="sd-saved-item-hull">{dHull?.name ?? d.hull}</span>
                      <span className="sd-saved-item-cost">{d.totalCost}cr</span>
                    </button>
                    {onDeleteDesign && (
                      <button
                        type="button"
                        className="sd-saved-item-delete"
                        onClick={(e) => { e.stopPropagation(); onDeleteDesign(d.id); }}
                        title={`Delete design: ${d.name}`}
                        style={{
                          position: 'absolute',
                          top: '2px',
                          right: '2px',
                          width: '18px',
                          height: '18px',
                          padding: 0,
                          border: '1px solid rgba(255,80,80,0.4)',
                          borderRadius: '3px',
                          background: 'rgba(255,40,40,0.15)',
                          color: '#ff6666',
                          fontSize: '12px',
                          lineHeight: '16px',
                          textAlign: 'center',
                          cursor: 'pointer',
                          zIndex: 1,
                          fontFamily: 'monospace',
                        }}
                      >
                        x
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
