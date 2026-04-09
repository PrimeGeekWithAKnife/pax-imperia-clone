/**
 * Trade dependency tracking — read-only computation that calculates what
 * percentage of an empire's trade income comes from each partner.
 *
 * Pure function, no state mutation.
 */

import type { BasicTradeRoute } from './trade.js';
import type { Galaxy, StarSystem } from '../types/galaxy.js';

/**
 * Calculate what percentage of an empire's trade income comes from each partner.
 * Returns a record mapping partner empire IDs to dependency scores (0.0 to 1.0).
 * A score of 0.8 means 80% of the empire's trade income comes from that partner.
 *
 * Routes with zero income are excluded from the calculation.
 * Routes whose destination system has no owner (or is owned by the queried empire
 * itself) are silently skipped.
 */
export function calculateTradeDependency(
  tradeRoutes: BasicTradeRoute[],
  empireId: string,
  galaxy: Galaxy,
): Record<string, number> {
  // Build a fast lookup from system ID to StarSystem.
  const systemMap = new Map<string, StarSystem>();
  for (const system of galaxy.systems) {
    systemMap.set(system.id, system);
  }

  // Accumulate income per partner empire.
  const incomeByPartner = new Map<string, number>();
  let totalIncome = 0;

  for (const route of tradeRoutes) {
    // Only consider routes belonging to this empire.
    if (route.empireId !== empireId) continue;

    // Skip zero-income routes — they contribute nothing to dependency.
    if (route.income <= 0) continue;

    // Resolve the partner empire from the destination system's owner.
    const destSystem = systemMap.get(route.destinationSystemId);
    if (!destSystem) continue;

    const partnerEmpireId = destSystem.ownerId;
    if (!partnerEmpireId || partnerEmpireId === empireId) continue;

    const existing = incomeByPartner.get(partnerEmpireId) ?? 0;
    incomeByPartner.set(partnerEmpireId, existing + route.income);
    totalIncome += route.income;
  }

  // No trade income — return empty record.
  if (totalIncome === 0) return {};

  // Convert absolute income to fractional dependency scores (0.0 to 1.0).
  const result: Record<string, number> = {};
  for (const [partnerId, income] of incomeByPartner) {
    result[partnerId] = income / totalIncome;
  }

  return result;
}
