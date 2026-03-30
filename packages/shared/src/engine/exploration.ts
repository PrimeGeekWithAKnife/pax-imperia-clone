/**
 * Anomaly exploration engine — pure functions for investigating space anomalies.
 *
 * Gameplay flow:
 *  1. A fleet arrives in a system containing an undiscovered anomaly → anomaly
 *     becomes "discovered" for that empire (handled by fleet movement).
 *  2. Player (or AI) issues an InvestigateAnomaly action → creates an ExplorationOrder.
 *  3. Each tick, active orders advance. If the investigating fleet leaves or is
 *     destroyed, the order is cancelled (progress lost).
 *  4. On completion, rewards are granted to the empire and the anomaly is marked
 *     as investigated.
 *
 * Investigation speed is influenced by:
 *  - Species research trait (1–10)
 *  - Ship sensor components in the fleet (each sensor reduces ticks by 5%)
 *  - Species affinity for the anomaly type (multiplier on rewards)
 */

import type { Anomaly, AnomalyReward, AnomalyRewardTemplate, ExplorationOrder } from '../types/anomaly.js';
import type { Empire } from '../types/species.js';
import type { Fleet, Ship, ShipDesign, ShipComponent } from '../types/ships.js';
import type { Galaxy } from '../types/galaxy.js';
import type { EmpireResources } from '../types/resources.js';
import type {
  AnomalyInvestigationStartedEvent,
  AnomalyInvestigatedEvent,
} from '../types/events.js';
import { generateId } from '../utils/id.js';
import { ANOMALY_REWARD_BY_TYPE } from '../../data/anomaly/index.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum sensor bonus (percentage reduction in investigation time). */
const MAX_SENSOR_BONUS = 0.50;

/** Per-sensor-component bonus (5% faster investigation per sensor). */
const SENSOR_BONUS_PER_COMPONENT = 0.05;

/** Minimum investigation ticks regardless of bonuses. */
const MIN_INVESTIGATION_TICKS = 5;

// ---------------------------------------------------------------------------
// Investigation order creation
// ---------------------------------------------------------------------------

/**
 * Validate and create a new exploration order.
 *
 * Returns null if the request is invalid (fleet not in system, anomaly
 * already investigated, etc.).
 */
export function createExplorationOrder(
  anomalyId: string,
  fleetId: string,
  galaxy: Galaxy,
  fleets: Fleet[],
  ships: Ship[],
  shipDesigns: Map<string, ShipDesign> | undefined,
  shipComponents: ShipComponent[] | undefined,
  empires: Empire[],
  existingOrders: ExplorationOrder[],
): ExplorationOrder | null {
  const anomaly = galaxy.anomalies.find((a) => a.id === anomalyId);
  if (!anomaly) return null;

  // Already investigated
  if (anomaly.investigated) return null;

  // Already being investigated by someone
  if (existingOrders.some((o) => o.anomalyId === anomalyId)) return null;

  const fleet = fleets.find((f) => f.id === fleetId);
  if (!fleet) return null;

  // Fleet must be in the same system as the anomaly
  if (fleet.position.systemId !== anomaly.systemId) return null;

  const empire = empires.find((e) => e.id === fleet.empireId);
  if (!empire) return null;

  const totalTicks = calculateInvestigationTicks(
    anomaly,
    empire,
    fleet,
    ships,
    shipDesigns,
    shipComponents,
  );

  return {
    id: generateId(),
    anomalyId,
    fleetId,
    empireId: empire.id,
    systemId: anomaly.systemId,
    totalTicks,
    ticksCompleted: 0,
  };
}

// ---------------------------------------------------------------------------
// Tick processing
// ---------------------------------------------------------------------------

export interface ExplorationTickResult {
  /** Updated exploration orders (completed orders removed). */
  orders: ExplorationOrder[];
  /** Updated anomalies array. */
  anomalies: Anomaly[];
  /** Updated empire resources map. */
  empireResourcesMap: Map<string, EmpireResources>;
  /** Events emitted this tick. */
  events: (AnomalyInvestigatedEvent)[];
}

/**
 * Advance all active exploration orders by one tick.
 *
 * Cancelled orders (fleet moved away or destroyed) are pruned.
 * Completed orders grant rewards and mark the anomaly as investigated.
 */
export function processExplorationTick(
  orders: ExplorationOrder[],
  galaxy: Galaxy,
  fleets: Fleet[],
  empires: Empire[],
  empireResourcesMap: Map<string, EmpireResources>,
  currentTick: number,
): ExplorationTickResult {
  const updatedOrders: ExplorationOrder[] = [];
  const events: AnomalyInvestigatedEvent[] = [];
  let anomalies = [...galaxy.anomalies];
  const resourcesMap = new Map(empireResourcesMap);

  for (const order of orders) {
    // Check fleet still exists and is in the correct system
    const fleet = fleets.find((f) => f.id === order.fleetId);
    if (!fleet || fleet.position.systemId !== order.systemId) {
      // Fleet moved away or destroyed — cancel order (progress lost)
      continue;
    }

    const advanced: ExplorationOrder = {
      ...order,
      ticksCompleted: order.ticksCompleted + 1,
    };

    if (advanced.ticksCompleted >= advanced.totalTicks) {
      // Investigation complete — grant rewards
      const anomaly = anomalies.find((a) => a.id === order.anomalyId);
      if (anomaly && !anomaly.investigated) {
        const empire = empires.find((e) => e.id === order.empireId);
        const rewards = calculateRewards(anomaly, empire ?? null);

        // Mark anomaly investigated
        anomalies = anomalies.map((a) =>
          a.id === anomaly.id
            ? { ...a, investigated: true, investigatedBy: order.empireId, rewards }
            : a,
        );

        // Grant resources
        const currentResources = resourcesMap.get(order.empireId);
        if (currentResources) {
          resourcesMap.set(order.empireId, applyRewards(currentResources, rewards));
        }

        events.push({
          type: 'AnomalyInvestigated',
          empireId: order.empireId,
          anomalyId: anomaly.id,
          anomalyName: anomaly.name,
          anomalyType: anomaly.type,
          systemId: anomaly.systemId,
          rewards,
          tick: currentTick,
        });
      }
      // Order complete — do not add to updatedOrders
    } else {
      updatedOrders.push(advanced);
    }
  }

  return {
    orders: updatedOrders,
    anomalies,
    empireResourcesMap: resourcesMap,
    events,
  };
}

// ---------------------------------------------------------------------------
// Discovery — mark anomalies as discovered when a fleet enters a system
// ---------------------------------------------------------------------------

/**
 * Check whether any anomalies in the given system should be marked as
 * discovered for the fleet's empire. Returns updated anomalies array if
 * changes were made.
 */
export function discoverAnomaliesInSystem(
  systemId: string,
  empireId: string,
  anomalies: Anomaly[],
): { anomalies: Anomaly[]; newlyDiscovered: Anomaly[] } {
  const newlyDiscovered: Anomaly[] = [];
  const updated = anomalies.map((a) => {
    if (a.systemId === systemId && !a.discovered) {
      newlyDiscovered.push(a);
      return { ...a, discovered: true };
    }
    return a;
  });

  return { anomalies: updated, newlyDiscovered };
}

// ---------------------------------------------------------------------------
// Reward calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the actual rewards for investigating an anomaly, scaled by
 * species affinity.
 */
export function calculateRewards(
  anomaly: Anomaly,
  empire: Empire | null,
): AnomalyReward {
  const template = ANOMALY_REWARD_BY_TYPE[anomaly.type];
  if (!template) {
    return { loreFragment: 'The anomaly yields no useful data.' };
  }

  let affinityMultiplier = 1.0;
  if (empire && template.speciesAffinity) {
    const speciesName = empire.species.name;
    affinityMultiplier = template.speciesAffinity[speciesName] ?? 1.0;
  }

  const base = template.baseRewards;
  const rewards: AnomalyReward = {};

  if (base.researchPoints) {
    rewards.researchPoints = Math.round(base.researchPoints * affinityMultiplier);
  }
  if (base.credits) {
    rewards.credits = Math.round(base.credits * affinityMultiplier);
  }
  if (base.minerals) {
    rewards.minerals = Math.round(base.minerals * affinityMultiplier);
  }
  if (base.rareElements) {
    rewards.rareElements = Math.round(base.rareElements * affinityMultiplier);
  }
  if (base.exoticMaterials) {
    rewards.exoticMaterials = Math.round(base.exoticMaterials * affinityMultiplier);
  }
  if (base.energy) {
    rewards.energy = Math.round(base.energy * affinityMultiplier);
  }
  if (base.loreFragment) {
    rewards.loreFragment = base.loreFragment;
  }

  return rewards;
}

// ---------------------------------------------------------------------------
// Investigation time calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the number of ticks needed to investigate an anomaly.
 *
 * Base ticks come from the reward template. Modifiers:
 *  - Species research trait: reduces ticks by up to 30% at trait 10
 *  - Fleet sensors: each sensor component reduces ticks by 5% (max 50%)
 */
export function calculateInvestigationTicks(
  anomaly: Anomaly,
  empire: Empire,
  fleet: Fleet,
  ships: Ship[],
  shipDesigns?: Map<string, ShipDesign>,
  shipComponents?: ShipComponent[],
): number {
  const template = ANOMALY_REWARD_BY_TYPE[anomaly.type];
  const baseTicks = template?.baseTicks ?? 20;

  // Research trait bonus: 0% at trait 1, 30% at trait 10
  const researchTrait = empire.species.traits.research;
  const researchBonus = ((researchTrait - 1) / 9) * 0.30;

  // Sensor bonus from fleet ships
  const sensorCount = countFleetSensors(fleet, ships, shipDesigns, shipComponents);
  const sensorBonus = Math.min(sensorCount * SENSOR_BONUS_PER_COMPONENT, MAX_SENSOR_BONUS);

  const totalReduction = Math.min(researchBonus + sensorBonus, 0.70); // Cap at 70%
  const ticks = Math.round(baseTicks * (1 - totalReduction));

  return Math.max(ticks, MIN_INVESTIGATION_TICKS);
}

/**
 * Count how many sensor components are fitted across all ships in a fleet.
 */
export function countFleetSensors(
  fleet: Fleet,
  ships: Ship[],
  shipDesigns?: Map<string, ShipDesign>,
  shipComponents?: ShipComponent[],
): number {
  if (!shipDesigns || !shipComponents) return 0;

  const componentById = new Map(shipComponents.map((c) => [c.id, c]));
  let count = 0;

  for (const shipId of fleet.ships) {
    const ship = ships.find((s) => s.id === shipId);
    if (!ship) continue;

    const design = shipDesigns.get(ship.designId);
    if (!design) continue;

    for (const slot of design.components) {
      const comp = componentById.get(slot.componentId);
      if (comp && (comp.type === 'sensor' || comp.type === 'advanced_sensors')) {
        count++;
      }
    }
  }

  return count;
}

// ---------------------------------------------------------------------------
// Resource application
// ---------------------------------------------------------------------------

/** Apply anomaly rewards to empire resources. */
function applyRewards(resources: EmpireResources, rewards: AnomalyReward): EmpireResources {
  return {
    ...resources,
    researchPoints: resources.researchPoints + (rewards.researchPoints ?? 0),
    credits: resources.credits + (rewards.credits ?? 0),
    minerals: resources.minerals + (rewards.minerals ?? 0),
    rareElements: resources.rareElements + (rewards.rareElements ?? 0),
    exoticMaterials: resources.exoticMaterials + (rewards.exoticMaterials ?? 0),
    energy: resources.energy + (rewards.energy ?? 0),
  };
}
