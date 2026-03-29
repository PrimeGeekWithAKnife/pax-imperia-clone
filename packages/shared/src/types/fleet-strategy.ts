/**
 * Fleet-level strategies, stances, and combined-arms roles.
 *
 * These types layer on top of the existing Fleet and Ship types to provide
 * tactical depth at fleet scale. A FleetStrategy defines how the fleet as a
 * whole manoeuvres, while FleetStance (extended from ships.ts base) adds a
 * behavioural overlay. ShipRole classifies individual ships for combined-arms
 * coordination.
 */

// ---------------------------------------------------------------------------
// Fleet strategy — high-level manoeuvre doctrine
// ---------------------------------------------------------------------------

/** Strategic manoeuvre pattern for the entire fleet. */
export type FleetStrategy =
  | 'circular_rotation'   // Ships rotate positions to distribute incoming fire
  | 'close_proximity'     // Close to boarding range; favours heavy armour
  | 'skirmish'            // Maintain optimal range, dart in and out
  | 'maximum_range'       // Kite at maximum weapon range, avoid closing
  | 'riker_manoeuvre'     // Fake retreat then rapid pivot to broadside
  | 'pincer'              // Split fleet into two wings that converge on target
  | 'wedge_formation'     // Arrow-head with flagship at tip; punches through lines
  | 'hit_and_run';        // Fast strike then immediate withdrawal

/** Human-readable descriptions for UI tooltips. */
export const FLEET_STRATEGY_DESCRIPTIONS: Record<FleetStrategy, string> = {
  circular_rotation: 'Ships rotate positions continuously, distributing incoming fire across the fleet.',
  close_proximity: 'Close to boarding range. Best with heavy armour and marines.',
  skirmish: 'Maintain optimal engagement distance, darting in and out of range.',
  maximum_range: 'Stay at maximum weapon range. Effective with long-range weaponry.',
  riker_manoeuvre: 'Feign retreat, then pivot sharply and deliver a devastating broadside.',
  pincer: 'Split the fleet into two wings that converge on the enemy from opposing angles.',
  wedge_formation: 'Arrow-head formation with the flagship at the tip, punching through enemy lines.',
  hit_and_run: 'Strike fast, deal burst damage, then withdraw before the enemy can respond.',
};

// ---------------------------------------------------------------------------
// Fleet stance — behavioural overlay (extends the base FleetStance from ships.ts)
// ---------------------------------------------------------------------------

/**
 * Extended fleet stance that adds tactical nuance beyond the base four stances
 * defined in ships.ts. The base FleetStance ('aggressive' | 'defensive' |
 * 'evasive' | 'patrol') remains canonical for fleet movement; this union adds
 * combat-specific stances.
 */
export type FleetCombatStance =
  | 'aggressive'   // Prioritise dealing damage; pursue fleeing ships
  | 'defensive'    // Hold position; focus fire on closest threats
  | 'flanking'     // Attempt to manoeuvre around enemy formation edges
  | 'escort'       // Protect a designated ship (e.g. carrier, transport)
  | 'patrol'       // Standard patrol behaviour; engage only when provoked
  | 'evasive';     // Minimise damage taken; avoid engagement when possible

// ---------------------------------------------------------------------------
// Ship role — combined-arms classification
// ---------------------------------------------------------------------------

/** Tactical role assigned to a ship within a fleet. Used by the AI and
 *  formation logic to position ships and assign targets. */
export type ShipRole =
  | 'line_ship'           // Primary combatant in the line of battle
  | 'carrier'             // Launches and recovers fighters / bombers
  | 'fighter'             // Small craft launched from carriers
  | 'electronic_warfare'  // ECM / ECCM disruption and sensor jamming
  | 'repair_ship'         // Field repairs and hull restoration
  | 'scout'               // Long-range sensors and reconnaissance
  | 'flagship'            // Command ship; fleet-wide morale and coordination bonuses
  | 'missile_boat'        // Standoff missile platform
  | 'point_defence';      // Specialises in intercepting missiles and fighters

/** Role-specific stat modifiers applied during tactical combat. */
export const SHIP_ROLE_MODIFIERS: Record<ShipRole, { damageModifier: number; defenceModifier: number; sensorModifier: number }> = {
  line_ship:          { damageModifier: 1.0, defenceModifier: 1.0, sensorModifier: 1.0 },
  carrier:            { damageModifier: 0.3, defenceModifier: 1.2, sensorModifier: 1.0 },
  fighter:            { damageModifier: 0.8, defenceModifier: 0.3, sensorModifier: 0.5 },
  electronic_warfare: { damageModifier: 0.4, defenceModifier: 0.8, sensorModifier: 2.0 },
  repair_ship:        { damageModifier: 0.2, defenceModifier: 1.0, sensorModifier: 0.8 },
  scout:              { damageModifier: 0.5, defenceModifier: 0.5, sensorModifier: 2.5 },
  flagship:           { damageModifier: 1.0, defenceModifier: 1.3, sensorModifier: 1.5 },
  missile_boat:       { damageModifier: 1.4, defenceModifier: 0.6, sensorModifier: 1.0 },
  point_defence:      { damageModifier: 0.6, defenceModifier: 1.0, sensorModifier: 1.2 },
};

// ---------------------------------------------------------------------------
// Fleet orders — what the player tells a fleet to do in combat
// ---------------------------------------------------------------------------

/** Priority target classification for focus-fire directives. */
export type TargetPriority =
  | 'nearest'
  | 'weakest'
  | 'strongest'
  | 'flagship'
  | 'carriers'
  | 'missile_boats'
  | 'repair_ships';

/** Orders issued to a fleet before or during a tactical engagement. */
export interface FleetOrders {
  /** The strategic manoeuvre pattern for the fleet. */
  strategy: FleetStrategy;
  /** Behavioural stance overlay. */
  stance: FleetCombatStance;
  /** Hull-point fraction (0-1) at which the fleet should attempt retreat. */
  retreatThreshold: number;
  /** Ordered list of target priorities — first match gets focused. */
  priorityTargets: TargetPriority[];
  /** Spacing between ships in formation (battlefield units). Lower = tighter. */
  formationSpacing: number;
  /** If true, flagship must be protected at all costs (escorts prioritise it). */
  protectFlagship: boolean;
  /** If set, the fleet will focus fire on a specific enemy ship ID. */
  focusFireTarget?: string;
}

/** Sensible default fleet orders for newly created fleets. */
export const DEFAULT_FLEET_ORDERS: FleetOrders = {
  strategy: 'skirmish',
  stance: 'aggressive',
  retreatThreshold: 0.3,
  priorityTargets: ['weakest', 'carriers', 'flagship'],
  formationSpacing: 80,
  protectFlagship: true,
};

// ---------------------------------------------------------------------------
// Shield sharing — late-game technology
// ---------------------------------------------------------------------------

/** A shield-sharing link between two ships in the same fleet.
 *  Requires the 'shield_harmonics' technology. */
export interface ShieldSharingLink {
  /** ID of the ship providing surplus shield energy. */
  sourceShipId: string;
  /** ID of the ship receiving shield energy. */
  targetShipId: string;
  /** Fraction of source ship's shield recharge per tick transferred (0-1). */
  transferRate: number;
  /** Maximum range in battlefield units for the link to remain active. */
  maxRange: number;
  /** Whether the link is currently active (ships may move out of range). */
  active: boolean;
}

/** Configuration for a fleet's shield-sharing network. */
export interface ShieldSharingNetwork {
  /** Technology required to enable shield sharing. */
  requiredTech: 'shield_harmonics';
  /** All active sharing links in the fleet. */
  links: ShieldSharingLink[];
  /** Total efficiency loss across the network (cumulative range penalty). */
  networkEfficiency: number;
}

// ---------------------------------------------------------------------------
// Shared targeting — coordinated fire control
// ---------------------------------------------------------------------------

/** Shared sensor/targeting data link between fleet members.
 *  Ships in a targeting network gain accuracy bonuses. */
export interface TargetingDataLink {
  /** Ship IDs participating in the targeting network. */
  participantShipIds: string[];
  /** Accuracy bonus multiplier (e.g. 1.15 = +15% accuracy). */
  accuracyBonus: number;
  /** Whether a scout ship is providing enhanced sensor data. */
  scoutDataAvailable: boolean;
  /** Whether an EW ship is contributing jamming resistance. */
  ewCountermeasuresActive: boolean;
}

// ---------------------------------------------------------------------------
// Fighter hangar management
// ---------------------------------------------------------------------------

/** State of a single fighter squadron launched from a carrier. */
export interface FighterSquadron {
  /** Unique squadron identifier. */
  id: string;
  /** Ship ID of the carrier that launched this squadron. */
  carrierShipId: string;
  /** Number of fighters still operational. */
  fightersRemaining: number;
  /** Maximum fighters in the squadron at launch. */
  maxFighters: number;
  /** Current target ship ID (null if returning to carrier). */
  targetShipId: string | null;
  /** Whether the squadron is returning to the carrier for rearming. */
  returning: boolean;
  /** Ticks remaining until rearmed (only relevant when docked). */
  rearmTicksRemaining: number;
}

/** Hangar state for a carrier ship. */
export interface CarrierHangarState {
  /** Ship ID of the carrier. */
  carrierShipId: string;
  /** Squadrons currently launched. */
  launchedSquadrons: FighterSquadron[];
  /** Number of reserve fighters still in the hangar. */
  reserveFighters: number;
  /** Maximum hangar capacity. */
  maxCapacity: number;
  /** Whether the carrier is currently recovering (landing) fighters. */
  recoveringFighters: boolean;
}
