/** Waste and energy state types for planetary management */

export interface PlanetWasteState {
  /** Current accumulated waste on the planet */
  currentWaste: number;
  /** Maximum waste capacity based on planet surface area */
  wasteCapacity: number;
  /** Net waste produced this tick (before reductions) */
  grossWastePerTick: number;
  /** Waste removed by recycling/processing this tick */
  wasteRemovedPerTick: number;
  /** Net waste change per tick */
  netWastePerTick: number;
  /** Whether waste has overflowed capacity */
  isOverflowing: boolean;
  /** Happiness penalty from waste (0 when under capacity, escalating when over) */
  wasteHappinessPenalty: number;
  /** Health penalty from waste overflow */
  wasteHealthPenalty: number;
}

export interface PlanetEnergyState {
  /** Total energy produced by power plants and generators this tick */
  totalProduction: number;
  /** Total energy demanded by all buildings this tick */
  totalDemand: number;
  /** Energy surplus (positive) or deficit (negative) */
  balance: number;
  /** Ratio of production to demand (1.0 = balanced) */
  ratio: number;
  /** Buildings that are powered off by player choice */
  disabledBuildingIds: string[];
  /** Happiness modifier from energy abundance/scarcity */
  energyHappinessModifier: number;
  /** Current stored energy (from energy storage buildings) */
  storedEnergy: number;
  /** Maximum storage capacity */
  storageCapacity: number;
}
