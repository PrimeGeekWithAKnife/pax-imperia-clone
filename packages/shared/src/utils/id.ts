/** ID generation utilities */

/**
 * Generates a short unique ID using crypto.randomUUID(), returning the first
 * segment for brevity (8 hex chars = ~4 billion possibilities per segment).
 * Falls back to a Math.random-based implementation in environments without
 * crypto support.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    // e.g. "550e8400-e29b-41d4-a716-446655440000" -> "550e8400"
    return crypto.randomUUID().split('-')[0];
  }
  // Fallback: 8 random hex chars
  return Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, '0');
}

/**
 * Generates a full UUID v4 string.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC 4122 version 4 UUID fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
