/**
 * Logarithmic spiral utilities shared between galaxy generation and rendering.
 *
 * Formula: r = a * e^(b * θ)
 *   a = starting radius (where arms emerge from the bulge)
 *   b = tightness parameter (lower = more open arms)
 */

/**
 * Compute the angle of a logarithmic spiral arm at a given radius.
 * Returns armStartAngle if radius <= spiralA.
 */
export function spiralArmAngleAtRadius(
  radius: number,
  armStartAngle: number,
  spiralA: number,
  spiralB: number,
): number {
  if (radius <= spiralA || spiralA <= 0) return armStartAngle;
  return armStartAngle + Math.log(radius / spiralA) / spiralB;
}

export interface SpiralPoint {
  x: number;
  y: number;
  /** Tangent angle of the spiral at this point (radians). */
  angle: number;
  /** Normalised distance from centre (0–1). */
  t: number;
}

/**
 * Sample N evenly-spaced-in-radius points along a logarithmic spiral arm.
 */
export function sampleSpiralArm(
  armStartAngle: number,
  spiralA: number,
  spiralB: number,
  centreX: number,
  centreY: number,
  maxRadius: number,
  sampleCount: number,
): SpiralPoint[] {
  const points: SpiralPoint[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = (i + 1) / (sampleCount + 1);
    const r = spiralA + t * (maxRadius - spiralA);
    const theta = spiralArmAngleAtRadius(r, armStartAngle, spiralA, spiralB);
    points.push({
      x: centreX + r * Math.cos(theta),
      y: centreY + r * Math.sin(theta),
      angle: theta,
      t,
    });
  }
  return points;
}
