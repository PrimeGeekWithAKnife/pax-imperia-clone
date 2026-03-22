/** Math helper utilities */

import type { Position2D } from '../types/galaxy.js';

/**
 * Clamps a value between min and max (inclusive).
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linearly interpolates between a and b by factor t.
 * t=0 returns a, t=1 returns b; t is not clamped.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Computes the Euclidean distance between two 2D positions.
 */
export function distance2D(a: Position2D, b: Position2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Returns a random floating-point number in [min, max).
 */
export function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Returns a random element from a non-empty array.
 * Throws if the array is empty.
 */
export function randomElement<T>(array: T[]): T {
  if (array.length === 0) {
    throw new Error('randomElement called with an empty array');
  }
  return array[Math.floor(Math.random() * array.length)] as T;
}
