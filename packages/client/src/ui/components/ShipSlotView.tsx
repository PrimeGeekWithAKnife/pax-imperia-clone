import React, { useState } from 'react';
import type { HullTemplate, ShipComponent, SlotPosition, ComponentType } from '@nova-imperia/shared';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SlotAssignment {
  slotId: string;
  componentId: string;
}

interface ShipSlotViewProps {
  hull: HullTemplate;
  assignments: SlotAssignment[];
  components: ShipComponent[];
  selectedSlotId: string | null;
  onSlotClick: (slotId: string) => void;
}

// ── Component type colors ──────────────────────────────────────────────────────

const COMPONENT_TYPE_COLOR: Record<ComponentType, string> = {
  weapon_beam:         'var(--slot-color-weapon)',
  weapon_projectile:   'var(--slot-color-weapon)',
  weapon_missile:      'var(--slot-color-weapon)',
  weapon_point_defense:'var(--slot-color-weapon)',
  fighter_bay:         'var(--slot-color-fighter)',
  shield:              'var(--slot-color-shield)',
  armor:               'var(--slot-color-armor)',
  engine:              'var(--slot-color-engine)',
  warp_drive:          'var(--slot-color-engine)',
  sensor:              'var(--slot-color-sensor)',
  repair_drone:        'var(--slot-color-repair)',
  special:             'var(--slot-color-special)',
  life_support:        'var(--slot-color-internal, #88aacc)',
  targeting_computer:  'var(--slot-color-internal, #88aacc)',
  advanced_sensors:    'var(--slot-color-sensor)',
  damage_control:      'var(--slot-color-repair)',
  ecm_suite:           'var(--slot-color-internal, #88aacc)',
  scanner:             'var(--slot-color-sensor)',
};

const FACING_ARROW: Record<SlotPosition['facing'], string> = {
  fore:      'N',
  aft:       'S',
  port:      'W',
  starboard: 'E',
  turret:    '*',
};

const SIZE_PX: Record<SlotPosition['size'], number> = {
  small:  34,
  medium: 44,
  large:  56,
};

// ── Slot abbreviation ──────────────────────────────────────────────────────────

function componentAbbrev(name: string): string {
  // Take up to 3 meaningful characters from the component name
  const words = name.split(/\s+/);
  if (words.length >= 2) {
    return (words[0]!.charAt(0) + words[1]!.charAt(0) + (words[2]?.charAt(0) ?? '')).toUpperCase();
  }
  return name.slice(0, 3).toUpperCase();
}

// ── Hull class label ───────────────────────────────────────────────────────────

function hullClassLabel(hull: HullTemplate): string {
  // Derive a display class name from the hull's class or name field
  const raw = (hull.class ?? hull.name ?? '').toUpperCase();
  return raw.length > 0 ? raw : 'VESSEL';
}

// ── ShipSlotView ───────────────────────────────────────────────────────────────

export function ShipSlotView({
  hull,
  assignments,
  components,
  selectedSlotId,
  onSlotClick,
}: ShipSlotViewProps): React.ReactElement {
  const [hoveredSlotId, setHoveredSlotId] = useState<string | null>(null);

  // Build lookup maps
  const componentById = new Map(components.map((c) => [c.id, c]));
  const assignmentBySlot = new Map(assignments.map((a) => [a.slotId, a.componentId]));

  // Determine canvas bounds from slot x/y coordinates
  const xs = hull.slotLayout.map((s) => s.x);
  const ys = hull.slotLayout.map((s) => s.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const SLOT_CELL = 68; // px per grid unit — larger than before for visibility
  const PADDING = 44;

  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;

  // Ensure the canvas is at least 300×250 even for very small hulls
  const canvasW = Math.max(300, cols * SLOT_CELL + PADDING * 2);
  const canvasH = Math.max(180, rows * SLOT_CELL + PADDING * 2);

  const slotToPixel = (sx: number, sy: number) => ({
    px: (sx - minX) * SLOT_CELL + PADDING,
    py: (sy - minY) * SLOT_CELL + PADDING,
  });

  const hoveredSlot = hoveredSlotId ? hull.slotLayout.find((s) => s.id === hoveredSlotId) : null;
  const hoveredComponent = hoveredSlotId && assignmentBySlot.has(hoveredSlotId)
    ? componentById.get(assignmentBySlot.get(hoveredSlotId)!)
    : null;

  return (
    <div className="ship-slot-view">
      {/* Ship class silhouette label */}
      <div className="ssv__class-label">{hullClassLabel(hull)}</div>

      {/* Direction legend */}
      <div className="ssv__legend">
        <span className="ssv__legend-item ssv__legend-item--fore">N = Fore</span>
        <span className="ssv__legend-item ssv__legend-item--aft">S = Aft</span>
        <span className="ssv__legend-item ssv__legend-item--port">W = Port</span>
        <span className="ssv__legend-item ssv__legend-item--star">E = Starboard</span>
        <span className="ssv__legend-item">* = Turret</span>
      </div>

      {/* Ship canvas */}
      <div
        className="ssv__canvas"
        style={{ width: canvasW, height: canvasH, position: 'relative' }}
      >
        {/* Ship silhouette background */}
        <div className="ssv__ship-body" style={{
          left: PADDING,
          top: PADDING,
          width: cols * SLOT_CELL,
          height: rows * SLOT_CELL,
        }} />

        {/* Slots */}
        {hull.slotLayout.map((slot) => {
          const { px, py } = slotToPixel(slot.x, slot.y);
          const componentId = assignmentBySlot.get(slot.id);
          const component = componentId ? componentById.get(componentId) : undefined;
          const isSelected = selectedSlotId === slot.id;
          const isHovered = hoveredSlotId === slot.id;
          const slotSize = SIZE_PX[slot.size];
          const offset = (SLOT_CELL - slotSize) / 2;

          // Determine color from filled component type or primary allowed type
          const displayType = component?.type ?? slot.allowedTypes[0] ?? 'special';
          const color = COMPONENT_TYPE_COLOR[displayType as ComponentType] ?? 'rgba(160,180,210,0.7)';

          // Brighter body fill for filled slots; lighter empty slot background
          const bgColor = component
            ? `${color}44`
            : isSelected
              ? 'rgba(0,212,255,0.18)'
              : 'rgba(15,40,75,0.75)';

          const borderColor = isSelected
            ? 'var(--color-accent)'
            : component
              ? color
              : 'rgba(80,140,200,0.55)';

          const shadow = isSelected
            ? `0 0 12px var(--color-accent), 0 0 20px rgba(0,212,255,0.3), inset 0 0 8px rgba(0,212,255,0.15)`
            : component
              ? `0 0 8px ${color}88, inset 0 0 4px ${color}22`
              : `0 0 4px rgba(0,120,180,0.3)`;

          return (
            <div
              key={slot.id}
              className={`ssv__slot ${isSelected ? 'ssv__slot--selected' : ''} ${isHovered ? 'ssv__slot--hovered' : ''} ${component ? 'ssv__slot--filled' : 'ssv__slot--empty'}`}
              style={{
                left: px + offset,
                top: py + offset,
                width: slotSize,
                height: slotSize,
                borderColor,
                background: bgColor,
                boxShadow: shadow,
              }}
              onClick={() => onSlotClick(slot.id)}
              onMouseEnter={() => setHoveredSlotId(slot.id)}
              onMouseLeave={() => setHoveredSlotId(null)}
              title={`${slot.id} [${slot.size}] — ${slot.allowedTypes.join(', ')}`}
            >
              {/* Facing arrow */}
              <span className="ssv__slot-facing">{FACING_ARROW[slot.facing]}</span>

              {/* Content */}
              {component ? (
                <span
                  className="ssv__slot-label"
                  style={{ color: color }}
                >
                  {componentAbbrev(component.name)}
                </span>
              ) : (
                <span className="ssv__slot-empty-icon">+</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Tooltip for hovered slot */}
      {hoveredSlot && (
        <div className="ssv__tooltip">
          <div className="ssv__tooltip-title">
            {hoveredSlot.id}
          </div>
          <div className="ssv__tooltip-row">
            <span className="ssv__tooltip-label">Facing</span>
            <span className="ssv__tooltip-value">{hoveredSlot.facing}</span>
          </div>
          <div className="ssv__tooltip-row">
            <span className="ssv__tooltip-label">Size</span>
            <span className="ssv__tooltip-value">{hoveredSlot.size}</span>
          </div>
          {hoveredComponent ? (
            <div className="ssv__tooltip-row">
              <span className="ssv__tooltip-label">Equipped</span>
              <span className="ssv__tooltip-value ssv__tooltip-filled">
                {hoveredComponent.name}
              </span>
            </div>
          ) : (
            <div className="ssv__tooltip-row">
              <span className="ssv__tooltip-label">Accepts</span>
              <span className="ssv__tooltip-value ssv__tooltip-muted">
                {hoveredSlot.allowedTypes.join(', ')}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Color type legend */}
      <div className="ssv__type-legend">
        <span className="ssv__type-chip ssv__type-chip--weapon">Weapon</span>
        <span className="ssv__type-chip ssv__type-chip--shield">Shield</span>
        <span className="ssv__type-chip ssv__type-chip--armor">Armor</span>
        <span className="ssv__type-chip ssv__type-chip--engine">Engine</span>
        <span className="ssv__type-chip ssv__type-chip--sensor">Sensor</span>
        <span className="ssv__type-chip ssv__type-chip--repair">Repair</span>
        <span className="ssv__type-chip ssv__type-chip--special">Special</span>
      </div>
    </div>
  );
}
