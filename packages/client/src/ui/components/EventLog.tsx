import React, { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GameLogEntry {
  /** Unique identifier for the entry. */
  id: number;
  /** Game tick when the event occurred. */
  tick: number;
  /** Human-readable event message. */
  message: string;
  /** Category for optional styling. */
  category: 'research' | 'construction' | 'ship' | 'colony' | 'migration' | 'combat' | 'general';
  /** Timestamp when the entry was created (Date.now()). */
  timestamp: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const MAX_ENTRIES = 20;
const HIGHLIGHT_DURATION_MS = 3000;

const CATEGORY_ICONS: Record<GameLogEntry['category'], string> = {
  research: '\u2697',
  construction: '\u2692',
  ship: '\u26f5',
  colony: '\u2691',
  migration: '\u21c4',
  combat: '\u2694',
  general: '\u2022',
};

// ── Component ──────────────────────────────────────────────────────────────────

interface EventLogProps {
  entries: GameLogEntry[];
}

export function EventLog({ entries }: EventLogProps): React.ReactElement {
  const [collapsed, setCollapsed] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(Date.now());

  // Periodically update `now` so highlight fading works
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [entries.length]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => !prev);
  }, []);

  const visibleEntries = entries.slice(-MAX_ENTRIES);

  return (
    <div
      className={`event-log${collapsed ? ' event-log--collapsed' : ''}`}
      style={{ pointerEvents: 'auto' }}
    >
      <button
        className="event-log__header"
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expand event log' : 'Collapse event log'}
      >
        <span className="event-log__title">EVENT LOG</span>
        <span className="event-log__toggle">{collapsed ? '\u25b6' : '\u25bc'}</span>
      </button>

      {!collapsed && (
        <div className="event-log__list" ref={listRef}>
          {visibleEntries.length === 0 && (
            <div className="event-log__empty">No events yet</div>
          )}
          {visibleEntries.map(entry => {
            const isNew = now - entry.timestamp < HIGHLIGHT_DURATION_MS;
            return (
              <div
                key={entry.id}
                className={`event-log__entry${isNew ? ' event-log__entry--new' : ''}`}
              >
                <span className="event-log__tick">T{entry.tick}</span>
                <span className="event-log__icon">{CATEGORY_ICONS[entry.category]}</span>
                <span className="event-log__message">{entry.message}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Helper: create a new log entry ─────────────────────────────────────────────

let nextEntryId = 1;

export function createLogEntry(
  tick: number,
  message: string,
  category: GameLogEntry['category'] = 'general',
): GameLogEntry {
  return {
    id: nextEntryId++,
    tick,
    message,
    category,
    timestamp: Date.now(),
  };
}
