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
