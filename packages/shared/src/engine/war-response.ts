/**
 * War Response engine — species-specific reactions to warfare, casualties, and
 * victories.
 *
 * Each species has a distinct psychological profile that determines how its
 * population responds to war.  The Khazari revel in it; the Vaelori are
 * shattered by it; hive minds barely notice it.
 *
 * This module provides:
 *  - Per-species war happiness modifiers (replacing the old flat -10)
 *  - War weariness accumulation and decay
 *  - Casualty sensitivity calculations
 *  - Victory momentum tracking
 *
 * All functions are pure — no side effects, no persistent state.
 */

import type { Species, SpecialAbility } from '../types/species.js';
import type { GovernmentType } from '../types/government.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-empire war state tracked between ticks. */
export interface EmpireWarState {
  /** Accumulated war weariness (0–100). Rises during war, decays during peace. */
  warWeariness: number;
  /** Ticks spent continuously at peace (used for Khazari peace discontent). */
  peaceTicks: number;
  /** Recent battle results for victory/defeat momentum. */
  recentBattles: BattleRecord[];
  /** Recent casualty events for casualty sensitivity. */
  recentCasualties: CasualtyRecord[];
}

/** A record of a recent battle outcome. */
export interface BattleRecord {
  /** Tick at which the battle occurred. */
  tick: number;
  /** Whether this empire won the engagement. */
  won: boolean;
  /** Whether a planet was captured (conquest) or lost. */
  planetCaptured: boolean;
  /** Whether a planet was lost to the enemy. */
  planetLost: boolean;
}

/** A record of ships lost in a single engagement. */
export interface CasualtyRecord {
  /** Tick at which the casualties occurred. */
  tick: number;
  /** Number of ships destroyed in this engagement. */
  shipsLost: number;
}

/** Breakdown of all war-related happiness factors for a single planet. */
export interface WarHappinessBreakdown {
  /** Total happiness points from all war factors combined. */
  total: number;
  /** Individual factor contributions for UI display. */
  factors: WarHappinessFactor[];
}

export interface WarHappinessFactor {
  label: string;
  points: number;
}

// ---------------------------------------------------------------------------
// Species war response profiles
// ---------------------------------------------------------------------------

interface WarProfile {
  /** Base happiness modifier when at war (positive = enjoys war). */
  warHappiness: number;
  /**
   * War weariness accumulation rate per tick at war.
   * Lower values mean the species tolerates prolonged war better.
   */
  wearinessRate: number;
  /** Happiness hit per ship destroyed. */
  casualtySensitivity: number;
  /** Happiness boost per battle won. */
  victoryBoost: number;
  /**
   * If true, this species suffers a happiness penalty during prolonged
   * peace (Khazari peace restlessness).
   */
  peacePenalty: boolean;
  /** Label for the war happiness factor in the UI. */
  warLabel: string;
}

/**
 * Per-species war response profiles, keyed by species ID.
 *
 * Species not in this map fall back to a generic profile derived from their
 * combat trait.
 */
const WAR_PROFILES: Record<string, WarProfile> = {
  // Khazari (combat 9, silicon_based): War is GLORIOUS. Forge-born warriors
  // who view conflict as both art and purpose.
  khazari: {
    warHappiness: +5,
    wearinessRate: 0.1,
    casualtySensitivity: -1,
    victoryBoost: +5,
    peacePenalty: true,
    warLabel: 'Glorious conflict',
  },

  // Vaelori (combat 3, psychic): War causes psychic distress. Every death
  // reverberates through the Lattice Harmonic.
  vaelori: {
    warHappiness: -20,
    wearinessRate: 0.5,
    casualtySensitivity: -5,
    victoryBoost: +1,
    peacePenalty: false,
    warLabel: 'Psychic anguish of war',
  },

  // Drakmari (combat 9, aquatic): War is natural predation — the Hunt made
  // galactic. A mild concern, not a crisis.
  drakmari: {
    warHappiness: -5,
    wearinessRate: 0.15,
    casualtySensitivity: -1,
    victoryBoost: +4,
    peacePenalty: false,
    warLabel: 'The Hunt continues',
  },

  // Sylvani (combat 2, photosynthetic): Deeply affected by destruction.
  // Every ship lost is a grove uprooted.
  sylvani: {
    warHappiness: -15,
    wearinessRate: 0.4,
    casualtySensitivity: -4,
    victoryBoost: +1,
    peacePenalty: false,
    warLabel: 'Destruction of the living',
  },

  // Nexari (combat 6, cybernetic + hive_mind): No individual opinion on war.
  // The collective processes it as pure data.
  nexari: {
    warHappiness: 0,
    wearinessRate: 0.05,
    casualtySensitivity: -0.5,
    victoryBoost: +1,
    peacePenalty: false,
    warLabel: 'Collective processing',
  },

  // Zorvathi (combat 6, subterranean + hive_mind): Swarm mentality — war is
  // territorial instinct. The network expands.
  zorvathi: {
    warHappiness: +3,
    wearinessRate: 0.05,
    casualtySensitivity: -0.5,
    victoryBoost: +3,
    peacePenalty: false,
    warLabel: 'Swarm expansion instinct',
  },

  // Teranos (combat 5, nomadic): Divided opinion — hawks and doves in
  // perpetual argument.
  teranos: {
    warHappiness: -8,
    wearinessRate: 0.3,
    casualtySensitivity: -3,
    victoryBoost: +3,
    peacePenalty: false,
    warLabel: 'Divided on the war',
  },

  // Ashkari (combat 5, nomadic): Pragmatic survivors. War threatens the
  // fleet — the only home they have.
  ashkari: {
    warHappiness: -12,
    wearinessRate: 0.35,
    casualtySensitivity: -4,
    victoryBoost: +2,
    peacePenalty: false,
    warLabel: 'Threat to the fleet',
  },

  // Luminari (combat 3, energy_form): Detached from physical conflict.
  // War is a curiosity they observe from outside.
  luminari: {
    warHappiness: -3,
    wearinessRate: 0.1,
    casualtySensitivity: -0.5,
    victoryBoost: +1,
    peacePenalty: false,
    warLabel: 'Observing physical conflict',
  },

  // Orivani (combat 8, devout): War is divine mandate under theocracy,
  // sacrilege otherwise.  Government determines the response.
  orivani: {
    warHappiness: -10, // Base — overridden by government check below
    wearinessRate: 0.2,
    casualtySensitivity: -2,
    victoryBoost: +4,
    peacePenalty: false,
    warLabel: 'Holy crusade', // Overridden contextually
  },

  // Kaelenth (combat 5, synthetic): Calculated, no emotional response.
  // War is a suboptimal resource allocation.
  kaelenth: {
    warHappiness: -2,
    wearinessRate: 0.08,
    casualtySensitivity: -0.5,
    victoryBoost: +1,
    peacePenalty: false,
    warLabel: 'Suboptimal resource allocation',
  },

  // Thyriaq (combat 3, nanomorphic): Conflict is resource competition.
  // The swarm redirects, not suffers.
  thyriaq: {
    warHappiness: -5,
    wearinessRate: 0.1,
    casualtySensitivity: -1,
    victoryBoost: +2,
    peacePenalty: false,
    warLabel: 'Resource competition',
  },

  // Aethyn (combat 5, dimensional): Barely affected by physical war.
  // Their true existence is elsewhere.
  aethyn: {
    warHappiness: -1,
    wearinessRate: 0.05,
    casualtySensitivity: -0.5,
    victoryBoost: +1,
    peacePenalty: false,
    warLabel: 'Distant physical concern',
  },

  // Vethara (combat 4, symbiotic): War threatens hosts — the most
  // precious resource their species possesses.
  vethara: {
    warHappiness: -18,
    wearinessRate: 0.45,
    casualtySensitivity: -5,
    victoryBoost: +2,
    peacePenalty: false,
    warLabel: 'Hosts in danger',
  },

  // Pyrenth (combat 8, silicon_based + subterranean): Forge-born.
  // Conflict tempers the strong; the weak are refined away.
  pyrenth: {
    warHappiness: +2,
    wearinessRate: 0.1,
    casualtySensitivity: -1,
    victoryBoost: +3,
    peacePenalty: false,
    warLabel: 'The forge of conflict',
  },
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of ticks a battle result contributes to victory/defeat momentum. */
const BATTLE_MOMENTUM_DURATION = 20;

/** Number of ticks a planet capture/loss contributes to momentum. */
const PLANET_MOMENTUM_DURATION = 30;

/** Happiness bonus for capturing a planet (territorial pride). */
const PLANET_CAPTURE_BONUS = 5;

/** Happiness penalty for losing a planet. */
const PLANET_LOSS_PENALTY = -5;

/** Number of ticks a casualty event affects happiness. */
const CASUALTY_EFFECT_DURATION = 15;

/** War weariness decay rate per tick during peace. */
const WEARINESS_PEACE_DECAY = 1.0;

/** Divisor converting war weariness (0–100) to happiness penalty. */
const WEARINESS_HAPPINESS_DIVISOR = 5;

/**
 * Ticks of continuous peace before Khazari start feeling restless.
 * ~50 ticks at standard speed = a reasonable "prolonged peace" threshold.
 */
const PEACE_RESTLESSNESS_THRESHOLD = 50;

/** Maximum peace penalty for war-loving species. */
const MAX_PEACE_PENALTY = -10;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a fresh war state for a newly created empire.
 */
export function createEmpireWarState(): EmpireWarState {
  return {
    warWeariness: 0,
    peaceTicks: 0,
    recentBattles: [],
    recentCasualties: [],
  };
}

/**
 * Advance the war state for a single empire by one tick.
 *
 * - At war: accumulate weariness, reset peace ticks.
 * - At peace: decay weariness, accumulate peace ticks.
 * - Always: prune expired battle and casualty records.
 *
 * @param state     Current war state for this empire.
 * @param isAtWar   Whether the empire is currently at war.
 * @param species   The empire's species (determines weariness rate).
 * @param currentTick Current game tick for record expiry.
 * @returns Updated war state.
 */
export function tickWarState(
  state: EmpireWarState,
  isAtWar: boolean,
  species: Species,
  currentTick: number,
): EmpireWarState {
  const profile = getWarProfile(species);

  let warWeariness = state.warWeariness;
  let peaceTicks = state.peaceTicks;

  if (isAtWar) {
    // Accumulate war weariness based on species tolerance.
    warWeariness = Math.min(100, warWeariness + profile.wearinessRate);
    peaceTicks = 0;
  } else {
    // Decay weariness during peace.
    warWeariness = Math.max(0, warWeariness - WEARINESS_PEACE_DECAY);
    peaceTicks = peaceTicks + 1;
  }

  // Prune expired records.
  const maxBattleAge = Math.max(BATTLE_MOMENTUM_DURATION, PLANET_MOMENTUM_DURATION);
  const recentBattles = state.recentBattles.filter(
    b => currentTick - b.tick <= maxBattleAge,
  );
  const recentCasualties = state.recentCasualties.filter(
    c => currentTick - c.tick <= CASUALTY_EFFECT_DURATION,
  );

  return {
    warWeariness,
    peaceTicks,
    recentBattles,
    recentCasualties,
  };
}

/**
 * Record a battle result in the empire's war state.
 * Call this from combat resolution.
 */
export function recordBattle(
  state: EmpireWarState,
  tick: number,
  won: boolean,
  planetCaptured = false,
  planetLost = false,
): EmpireWarState {
  return {
    ...state,
    recentBattles: [
      ...state.recentBattles,
      { tick, won, planetCaptured, planetLost },
    ],
  };
}

/**
 * Record ship casualties in the empire's war state.
 * Call this from combat resolution when ships are destroyed.
 */
export function recordCasualties(
  state: EmpireWarState,
  tick: number,
  shipsLost: number,
): EmpireWarState {
  if (shipsLost <= 0) return state;
  return {
    ...state,
    recentCasualties: [
      ...state.recentCasualties,
      { tick, shipsLost },
    ],
  };
}

/**
 * Calculate the full war-related happiness impact for a planet, taking into
 * account species psychology, war weariness, recent battles, and casualties.
 *
 * Replaces the old flat -10 "At war" penalty with a rich, species-specific
 * breakdown.
 *
 * @param species     The empire's species.
 * @param isAtWar     Whether the empire is at war.
 * @param warState    The empire's current war state.
 * @param government  The empire's government type.
 * @param currentTick Current game tick (for record age calculations).
 * @returns Breakdown of war-related happiness factors.
 */
export function calculateWarHappinessImpact(
  species: Species,
  isAtWar: boolean,
  warState: EmpireWarState,
  government: GovernmentType,
  currentTick: number,
): WarHappinessBreakdown {
  const factors: WarHappinessFactor[] = [];
  let total = 0;

  const profile = getWarProfile(species);

  // ── 1. Base war happiness modifier ─────────────────────────────────────
  if (isAtWar) {
    let warPts = profile.warHappiness;
    let label = profile.warLabel;

    // Orivani special case: theocracy treats war as divine mandate.
    if (species.id === 'orivani') {
      if (government === 'theocracy') {
        warPts = +8;
        label = 'Holy crusade';
      } else {
        warPts = -15;
        label = 'Unjust war (no divine mandate)';
      }
    }

    if (warPts !== 0) {
      total += warPts;
      factors.push({ label, points: warPts });
    }
  }

  // ── 2. War weariness penalty ───────────────────────────────────────────
  if (warState.warWeariness > 0) {
    const wearinessPenalty = -Math.floor(warState.warWeariness / WEARINESS_HAPPINESS_DIVISOR);
    if (wearinessPenalty !== 0) {
      total += wearinessPenalty;
      factors.push({
        label: `War weariness (${Math.round(warState.warWeariness)}%)`,
        points: wearinessPenalty,
      });
    }
  }

  // ── 3. Peace restlessness (war-loving species only) ────────────────────
  if (
    !isAtWar &&
    profile.peacePenalty &&
    warState.peaceTicks > PEACE_RESTLESSNESS_THRESHOLD
  ) {
    // Scales from 0 to MAX_PEACE_PENALTY over 100 additional ticks of peace.
    const excessPeace = warState.peaceTicks - PEACE_RESTLESSNESS_THRESHOLD;
    const penalty = Math.max(
      MAX_PEACE_PENALTY,
      -Math.floor(excessPeace / 10),
    );
    if (penalty !== 0) {
      total += penalty;
      factors.push({
        label: 'Restless during peace',
        points: penalty,
      });
    }
  }

  // ── 4. Victory / defeat momentum ──────────────────────────────────────
  let victoryMomentum = 0;
  let defeatMomentum = 0;
  let planetCaptureMomentum = 0;
  let planetLossMomentum = 0;

  for (const battle of warState.recentBattles) {
    const age = currentTick - battle.tick;

    // Battle win/loss — decays over BATTLE_MOMENTUM_DURATION ticks.
    if (age <= BATTLE_MOMENTUM_DURATION) {
      const decay = 1 - (age / BATTLE_MOMENTUM_DURATION);
      if (battle.won) {
        victoryMomentum += profile.victoryBoost * decay;
      } else {
        defeatMomentum += profile.victoryBoost * decay;
      }
    }

    // Planet capture/loss — decays over PLANET_MOMENTUM_DURATION ticks.
    if (age <= PLANET_MOMENTUM_DURATION) {
      const decay = 1 - (age / PLANET_MOMENTUM_DURATION);
      if (battle.planetCaptured) {
        planetCaptureMomentum += PLANET_CAPTURE_BONUS * decay;
      }
      if (battle.planetLost) {
        planetLossMomentum += PLANET_LOSS_PENALTY * decay;
      }
    }
  }

  if (victoryMomentum > 0) {
    const pts = Math.round(victoryMomentum);
    if (pts > 0) {
      total += pts;
      factors.push({ label: 'Victories in battle', points: pts });
    }
  }
  if (defeatMomentum > 0) {
    const pts = -Math.round(defeatMomentum);
    if (pts !== 0) {
      total += pts;
      factors.push({ label: 'Defeats in battle', points: pts });
    }
  }
  if (planetCaptureMomentum > 0) {
    const pts = Math.round(planetCaptureMomentum);
    if (pts > 0) {
      total += pts;
      factors.push({ label: 'Territorial conquest', points: pts });
    }
  }
  if (planetLossMomentum < 0) {
    const pts = Math.round(planetLossMomentum);
    if (pts !== 0) {
      total += pts;
      factors.push({ label: 'Territory lost', points: pts });
    }
  }

  // ── 5. Casualty sensitivity ────────────────────────────────────────────
  let casualtyPenalty = 0;
  for (const casualty of warState.recentCasualties) {
    const age = currentTick - casualty.tick;
    if (age <= CASUALTY_EFFECT_DURATION) {
      const decay = 1 - (age / CASUALTY_EFFECT_DURATION);
      casualtyPenalty += profile.casualtySensitivity * casualty.shipsLost * decay;
    }
  }
  if (casualtyPenalty !== 0) {
    const pts = Math.round(casualtyPenalty);
    if (pts !== 0) {
      total += pts;
      factors.push({ label: 'Casualties suffered', points: pts });
    }
  }

  return { total, factors };
}

/**
 * Whether the empire's war weariness has reached crisis level (>80).
 * At this threshold, unrest events (strikes, protests) become likely.
 */
export function isWarWearinessCrisis(warState: EmpireWarState): boolean {
  return warState.warWeariness > 80;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Look up or derive the war profile for a species.
 *
 * Named species have hand-crafted profiles. Unknown species (custom races)
 * get a generic profile derived from their combat trait.
 */
function getWarProfile(species: Species): WarProfile {
  const known = WAR_PROFILES[species.id];
  if (known) return known;

  // Fallback for modded / custom species: derive from traits and abilities.
  return deriveWarProfile(species);
}

/**
 * Derive a war profile from species traits and abilities for species not
 * in the hand-crafted table.
 */
function deriveWarProfile(species: Species): WarProfile {
  const combat = species.traits.combat;
  const abilities = species.specialAbilities;

  const isHiveMind = abilities.includes('hive_mind');
  const isSynthetic = abilities.includes('synthetic');
  const isEnergyForm = abilities.includes('energy_form');
  const isDimensional = abilities.includes('dimensional');

  // Base war happiness: high combat species tolerate or enjoy war.
  // Scale from -15 (combat 1) to +5 (combat 10).
  let warHappiness = Math.round((combat - 6) * 3.33);
  if (isHiveMind) warHappiness = 0;
  if (isSynthetic || isEnergyForm || isDimensional) {
    warHappiness = Math.round(warHappiness * 0.2);
  }

  // Weariness rate: combat-oriented species tire slower.
  let wearinessRate = 0.55 - (combat * 0.05);
  if (isHiveMind) wearinessRate = 0.05;
  wearinessRate = Math.max(0.05, wearinessRate);

  // Casualty sensitivity: based on reproduction trait.
  // High reproduction = expendable individuals = lower sensitivity.
  const reproduction = species.traits.reproduction;
  let casualtySensitivity = -1;
  if (reproduction <= 3) casualtySensitivity = -5;
  else if (reproduction <= 5) casualtySensitivity = -3;
  else if (reproduction <= 7) casualtySensitivity = -2;
  if (isSynthetic || isEnergyForm) casualtySensitivity = -0.5;

  return {
    warHappiness,
    wearinessRate,
    casualtySensitivity,
    victoryBoost: combat >= 7 ? +4 : +2,
    peacePenalty: combat >= 9 && !isHiveMind,
    warLabel: warHappiness >= 0 ? 'Conflict embraced' : 'At war',
  };
}
