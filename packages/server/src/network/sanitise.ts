/**
 * Input sanitisation for network payloads.
 *
 * All player-supplied strings must pass through these functions before use
 * to prevent injection, excessive length, and control character abuse.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum length for player display names. */
const MAX_PLAYER_NAME_LENGTH = 40;

/** Maximum length for game/lobby names. */
const MAX_GAME_NAME_LENGTH = 60;

/** Maximum length for chat messages. */
const MAX_CHAT_MESSAGE_LENGTH = 500;

/** Maximum length for password strings. */
const MAX_PASSWORD_LENGTH = 128;

/** Maximum length for seed strings. */
const MAX_SEED_LENGTH = 32;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip control characters (U+0000–U+001F, U+007F–U+009F) except common
 * whitespace (tab, newline, carriage return — though we also strip those for
 * single-line fields). Prevents injection of terminal escape sequences and
 * invisible Unicode into strings that will be displayed or logged.
 */
function stripControlChars(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
}

/**
 * Truncate a string to a maximum length, ensuring we do not split a
 * multi-byte UTF-8 sequence (though in practice JS strings are UTF-16
 * so we just slice by code-unit count).
 */
function truncate(input: string, maxLength: number): string {
  return input.length > maxLength ? input.slice(0, maxLength) : input;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sanitise a player display name.
 *
 * - Strips control characters
 * - Trims leading/trailing whitespace
 * - Truncates to MAX_PLAYER_NAME_LENGTH
 * - Returns null if the result is empty (caller should reject the request)
 */
export function sanitisePlayerName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = truncate(stripControlChars(raw).trim(), MAX_PLAYER_NAME_LENGTH);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Sanitise a game/lobby name.
 */
export function sanitiseGameName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = truncate(stripControlChars(raw).trim(), MAX_GAME_NAME_LENGTH);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Sanitise a chat message.
 * Allows newlines (multi-line chat) but strips other control characters.
 */
export function sanitiseChatMessage(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  // Preserve newlines but remove other control chars
  const cleaned = truncate(
    raw.replace(/[\x00-\x09\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, '').trim(),
    MAX_CHAT_MESSAGE_LENGTH,
  );
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Sanitise a password. Returns undefined for empty/missing, the sanitised
 * string otherwise. Does not validate strength — that is the player's concern.
 */
export function sanitisePassword(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'string') return undefined;
  const cleaned = truncate(raw, MAX_PASSWORD_LENGTH);
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * Sanitise a galaxy seed string.
 */
export function sanitiseSeed(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return truncate(stripControlChars(raw).trim(), MAX_SEED_LENGTH);
}

// ---------------------------------------------------------------------------
// Enum / structured field validators
// ---------------------------------------------------------------------------

/** Maximum length for a species ID string. */
const MAX_SPECIES_ID_LENGTH = 60;

/**
 * Sanitise a species identifier.
 * Returns null if the result is empty or non-string.
 */
export function sanitiseSpeciesId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = truncate(stripControlChars(raw).trim(), MAX_SPECIES_ID_LENGTH);
  return cleaned.length > 0 ? cleaned : null;
}

/** Allowed galaxy size values. */
const VALID_GALAXY_SIZES = new Set(['small', 'medium', 'large', 'huge']);

/** Allowed galaxy shape values. */
const VALID_GALAXY_SHAPES = new Set(['spiral', 'elliptical', 'irregular', 'ring']);

/**
 * Validate and sanitise galaxy configuration fields.
 * Returns a safe copy with invalid values replaced by defaults.
 */
export function sanitiseGalaxyConfig(raw: unknown): { size: string; shape: string; seed: string } {
  const obj = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
  const size = typeof obj['size'] === 'string' && VALID_GALAXY_SIZES.has(obj['size']) ? obj['size'] : 'medium';
  const shape = typeof obj['shape'] === 'string' && VALID_GALAXY_SHAPES.has(obj['shape']) ? obj['shape'] : 'spiral';
  const seed = sanitiseSeed(obj['seed']);
  return { size, shape, seed };
}

/**
 * Maximum recursion depth for deep-cleaning user-supplied objects.
 * Prevents stack overflow from deeply nested payloads.
 */
const MAX_DEPTH = 10;

/**
 * Strip dangerous keys (__proto__, constructor, prototype) from a plain
 * object to prevent prototype pollution. Returns a sanitised shallow copy
 * at each level, up to MAX_DEPTH. Non-object values pass through unchanged.
 */
export function sanitiseObject(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return undefined;
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map((v) => sanitiseObject(v, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    result[key] = sanitiseObject((value as Record<string, unknown>)[key], depth + 1);
  }
  return result;
}
