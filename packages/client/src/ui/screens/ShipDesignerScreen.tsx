import React, { useState, useCallback, useMemo, useRef } from 'react';
import type { ShipComponent, ShipDesign, ComponentType, HullClass } from '@nova-imperia/shared';
import { renderShipIcon } from '../../assets/graphics';
import {
  validateDesign,
  calculateDesignStats,
  autoEquipDesign,
  getAvailableComponents,
} from '@nova-imperia/shared';
import type { DesignStats } from '@nova-imperia/shared';
import { HULL_TEMPLATES, SHIP_COMPONENTS } from '@nova-imperia/shared-data/ships/index.js';
import { ShipSlotView } from '../components/ShipSlotView';
import type { SlotAssignment } from '../components/ShipSlotView';

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
  armor:               'Armor',
  engine:              'Engine',
  warp_drive:          'Warp Drive',
  sensor:              'Sensor',
  repair_drone:        'Repair Drone',
  special:             'Special',
};

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
      return `spd ${s['speed'] ?? 0}`;
    case 'warp_drive':
      return `warp ${s['warpSpeed'] ?? 0}`;
    case 'sensor':
      return `rng ${s['sensorRange'] ?? 0}`;
    case 'repair_drone':
      return `${s['repairRate'] ?? 0}/tick`;
    case 'special':
      return `cost ${component.cost}`;
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
  empireId: string;
  savedDesigns: ShipDesign[];
  onSaveDesign: (design: ShipDesign) => void;
  onClose: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ShipDesignerScreen({
  researchedTechs,
  empireId,
  savedDesigns,
  onSaveDesign,
  onClose,
}: ShipDesignerScreenProps): React.ReactElement {
  // ── Hull selection ──────────────────────────────────────────────────────────
  const [selectedHullClass, setSelectedHullClass] = useState<HullClass>('scout');

  // ── Current working design ──────────────────────────────────────────────────
  const [designName, setDesignName] = useState('New Design');
  const [assignments, setAssignments] = useState<SlotAssignment[]>([]);

  // ── Slot/component picker state ─────────────────────────────────────────────
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

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
    }),
    [designName, hull.class, assignments, empireId],
  );

  const validationResult = useMemo(
    () => validateDesign(currentDesign, hull, SHIP_COMPONENTS),
    [currentDesign, hull],
  );

  const designStats = useMemo(
    () => calculateDesignStats(currentDesign, hull, SHIP_COMPONENTS),
    [currentDesign, hull],
  );

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
    setSelectedSlotId(null);
    setPickerOpen(false);
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
          {/* ── LEFT: Hull Selection ───────────────────────────────────── */}
          <div className="ship-designer__left">
            <div className="sd-col-label">HULL CLASS</div>
            <div className="sd-hull-list">
              {HULL_TEMPLATES.map((h) => {
                const unlocked =
                  researchedTechs.includes(h.requiredAge) || h.requiredAge === 'nano_atomic';
                const isSelected = h.class === selectedHullClass;

                return (
                  <button
                    key={h.class}
                    type="button"
                    className={`sd-hull-item ${isSelected ? 'sd-hull-item--selected' : ''} ${!unlocked ? 'sd-hull-item--locked' : ''}`}
                    onClick={() => unlocked && handleHullSelect(h.class)}
                    disabled={!unlocked}
                    title={!unlocked ? `Requires: ${AGE_DISPLAY[h.requiredAge] ?? h.requiredAge}` : h.name}
                  >
                    <div className="sd-hull-icon">
                      <HullIcon hullClass={h.class} />
                    </div>
                    <div className="sd-hull-info">
                      <div className="sd-hull-name">{h.name}</div>
                      <div className="sd-hull-stats">
                        <span>{h.baseHullPoints} HP</span>
                        <span>{h.maxSlots} slots</span>
                        <span>{h.baseCost}cr</span>
                        <span>spd {h.baseSpeed}</span>
                      </div>
                      {!unlocked && (
                        <div className="sd-hull-locked-msg">
                          Requires: {AGE_DISPLAY[h.requiredAge] ?? h.requiredAge}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── CENTER: Slot Layout ────────────────────────────────────── */}
          <div className="ship-designer__center">
            <div className="sd-col-label">
              {hull.name.toUpperCase()} — SLOT LAYOUT
              <span className="sd-col-label-hint">
                {assignments.length}/{hull.maxSlots} filled
              </span>
            </div>

            <div className="sd-slot-area">
              <ShipSlotView
                hull={hull}
                assignments={assignments}
                components={SHIP_COMPONENTS}
                selectedSlotId={selectedSlotId}
                onSlotClick={handleSlotClick}
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
                <span className="sd-stat-label">Hull Points</span>
                <span className="sd-stat-value">{hull.baseHullPoints}</span>
              </div>
              <div className="sd-stat-row">
                <span className="sd-stat-label">Slots</span>
                <span className="sd-stat-value">
                  {assignments.length}/{hull.maxSlots}
                </span>
              </div>
            </div>

            {/* Aggregated stats */}
            <div className="sd-stats-section">
              <div className="sd-stats-section-label">COMBAT STATS</div>

              {/* Stat with compare bars */}
              {(
                [
                  { label: 'Total Damage',   value: designStats.totalDamage,   compare: compareStats?.totalDamage,   unit: 'dmg' },
                  { label: 'Shield Strength',value: designStats.totalShields,  compare: compareStats?.totalShields,  unit: 'str' },
                  { label: 'Armor Rating',   value: designStats.totalArmor,    compare: compareStats?.totalArmor,    unit: 'AR'  },
                  { label: 'Speed',          value: designStats.speed,         compare: compareStats?.speed,         unit: ''    },
                  { label: 'Sensor Range',   value: designStats.sensorRange,   compare: compareStats?.sensorRange,   unit: ''    },
                  { label: 'Repair Rate',    value: designStats.repairRate,    compare: compareStats?.repairRate,    unit: '/t'  },
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
                        <span className="sd-stat-value">
                          {value}{unit}
                        </span>
                        {hasCompare && (
                          <span className={`sd-stat-diff ${diff > 0 ? 'sd-stat-diff--pos' : diff < 0 ? 'sd-stat-diff--neg' : ''}`}>
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="sd-stat-bar-track">
                      <div
                        className="sd-stat-bar-fill"
                        style={{ width: `${pct}%` }}
                      />
                      {hasCompare && (
                        <div
                          className="sd-stat-bar-compare"
                          style={{ width: `${cmpPct}%` }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
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
                  <button
                    key={d.id}
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
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
