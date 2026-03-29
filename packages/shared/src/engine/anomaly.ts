/**
 * Anomaly investigation engine — pure functions for discovery, scanning,
 * excavation and precursor lore generation.
 *
 * All functions are side-effect free. Callers must persist the returned
 * state and events to their own game state records.
 *
 * Design goals:
 *  - Multi-stage excavation: surface survey → initial dig → deep excavation → artefact recovery
 *  - Some sites are dangerous — player-choice risk/reward, never forced punishment
 *  - Misinformation possible on scan results (low-accuracy scanners)
 *  - First-scanner gets exclusive intelligence (knowledge is competitive)
 *  - Precursor ruins form a Devourer breadcrumb trail (100+ world empire, close to solving Devourers)
 */

import type { Planet } from '../types/galaxy.js';
import type {
  Anomaly,
  AnomalyType,
  AnomalyReward,
  AnomalyDanger,
  ExcavationStage,
  ExcavationSite,
  ScanResult,
  ScanData,
  ScanLevel,
  RiskChoice,
} from '../types/anomaly.js';
import { generateId } from '../utils/id.js';

// ---------------------------------------------------------------------------
// Event types emitted by the anomaly engine
// ---------------------------------------------------------------------------

/** Union of all events emitted during anomaly processing. */
export type AnomalyEvent =
  | ExcavationProgressEvent
  | ExcavationStageCompleteEvent
  | DangerEncounteredEvent
  | LoreDiscoveredEvent
  | ExcavationCompleteEvent;

export interface ExcavationProgressEvent {
  type: 'excavation_progress';
  siteId: string;
  stage: ExcavationStage;
  ticksRemaining: number;
}

export interface ExcavationStageCompleteEvent {
  type: 'excavation_stage_complete';
  siteId: string;
  completedStage: ExcavationStage;
  nextStage: ExcavationStage;
  reward?: AnomalyReward;
}

export interface DangerEncounteredEvent {
  type: 'danger_encountered';
  siteId: string;
  dangerType: AnomalyDanger;
  dangerLevel: number;
  /** Awaits player decision — excavation pauses until riskChoice is set. */
  requiresChoice: boolean;
}

export interface LoreDiscoveredEvent {
  type: 'lore_discovered';
  siteId: string;
  fragment: string;
}

export interface ExcavationCompleteEvent {
  type: 'excavation_complete';
  siteId: string;
  totalRewards: AnomalyReward;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base ticks required for each excavation stage. */
export const STAGE_DURATIONS: Record<ExcavationStage, number> = {
  undiscovered: 0,
  detected: 0,
  surface_survey: 8,
  initial_dig: 15,
  deep_excavation: 25,
  artefact_recovery: 20,
  complete: 0,
};

/** Ordered progression of excavation stages. */
const STAGE_ORDER: ExcavationStage[] = [
  'undiscovered',
  'detected',
  'surface_survey',
  'initial_dig',
  'deep_excavation',
  'artefact_recovery',
  'complete',
];

/** Probability (0–1) that each anomaly type spawns per planet in a system. */
const ANOMALY_SPAWN_CHANCES: Record<AnomalyType, number> = {
  precursor_ruins: 0.04,
  derelict_vessel: 0.06,
  spatial_rift: 0.03,
  mineral_deposit: 0.12,
  energy_signature: 0.05,
  sealed_wormhole: 0.02,
  debris_field: 0.08,
  living_nebula: 0.03,
  gravity_anomaly: 0.04,
  ancient_beacon: 0.02,
};

/** Danger type weights per anomaly type (null = no danger possible). */
const DANGER_TABLE: Partial<Record<AnomalyType, { type: AnomalyDanger; weight: number }[]>> = {
  precursor_ruins: [
    { type: 'automated_defences', weight: 0.4 },
    { type: 'precursor_trap', weight: 0.3 },
    { type: 'radiation', weight: 0.2 },
    { type: 'pathogen', weight: 0.1 },
  ],
  derelict_vessel: [
    { type: 'automated_defences', weight: 0.3 },
    { type: 'radiation', weight: 0.4 },
    { type: 'pathogen', weight: 0.3 },
  ],
  spatial_rift: [
    { type: 'spatial_instability', weight: 0.7 },
    { type: 'radiation', weight: 0.3 },
  ],
  energy_signature: [
    { type: 'radiation', weight: 0.5 },
    { type: 'spatial_instability', weight: 0.3 },
    { type: 'precursor_trap', weight: 0.2 },
  ],
  sealed_wormhole: [
    { type: 'spatial_instability', weight: 0.6 },
    { type: 'precursor_trap', weight: 0.4 },
  ],
  debris_field: [
    { type: 'radiation', weight: 0.5 },
    { type: 'automated_defences', weight: 0.3 },
    { type: 'hostile_fauna', weight: 0.2 },
  ],
  living_nebula: [
    { type: 'hostile_fauna', weight: 0.5 },
    { type: 'pathogen', weight: 0.3 },
    { type: 'spatial_instability', weight: 0.2 },
  ],
  ancient_beacon: [
    { type: 'precursor_trap', weight: 0.5 },
    { type: 'automated_defences', weight: 0.3 },
    { type: 'radiation', weight: 0.2 },
  ],
};

// ---------------------------------------------------------------------------
// Reward tables — per anomaly type and excavation stage
// ---------------------------------------------------------------------------

/** Base rewards granted when each excavation stage completes, by anomaly type. */
const REWARD_TABLES: Record<AnomalyType, Partial<Record<ExcavationStage, AnomalyReward>>> = {
  precursor_ruins: {
    surface_survey: { researchPoints: 50 },
    initial_dig: { researchPoints: 120, rareElements: 15 },
    deep_excavation: { researchPoints: 300, exoticMaterials: 25 },
    artefact_recovery: { researchPoints: 500, exoticMaterials: 50, techUnlock: 'precursor_alloys' },
  },
  derelict_vessel: {
    surface_survey: { researchPoints: 30, minerals: 20 },
    initial_dig: { researchPoints: 80, minerals: 60, rareElements: 10 },
    deep_excavation: { researchPoints: 150, rareElements: 30 },
    artefact_recovery: { researchPoints: 200, exoticMaterials: 20, techUnlock: 'salvaged_drives' },
  },
  spatial_rift: {
    surface_survey: { researchPoints: 80 },
    initial_dig: { researchPoints: 200 },
    deep_excavation: { researchPoints: 400, exoticMaterials: 15 },
    artefact_recovery: { researchPoints: 600, techUnlock: 'rift_harmonics' },
  },
  mineral_deposit: {
    surface_survey: { minerals: 50 },
    initial_dig: { minerals: 150, rareElements: 20 },
    deep_excavation: { minerals: 300, rareElements: 50 },
    artefact_recovery: { minerals: 500, rareElements: 80, exoticMaterials: 10 },
  },
  energy_signature: {
    surface_survey: { researchPoints: 60 },
    initial_dig: { researchPoints: 150, exoticMaterials: 5 },
    deep_excavation: { researchPoints: 250, exoticMaterials: 20 },
    artefact_recovery: { researchPoints: 400, exoticMaterials: 40, techUnlock: 'dark_energy_tap' },
  },
  sealed_wormhole: {
    surface_survey: { researchPoints: 100 },
    initial_dig: { researchPoints: 250 },
    deep_excavation: { researchPoints: 500, exoticMaterials: 30 },
    artefact_recovery: { researchPoints: 800, techUnlock: 'wormhole_stabiliser' },
  },
  debris_field: {
    surface_survey: { minerals: 30, researchPoints: 20 },
    initial_dig: { minerals: 80, rareElements: 15 },
    deep_excavation: { minerals: 150, rareElements: 30, researchPoints: 100 },
    artefact_recovery: { minerals: 200, rareElements: 50, exoticMaterials: 10 },
  },
  living_nebula: {
    surface_survey: { researchPoints: 70 },
    initial_dig: { researchPoints: 180, rareElements: 10 },
    deep_excavation: { researchPoints: 350, exoticMaterials: 15 },
    artefact_recovery: { researchPoints: 500, exoticMaterials: 30, techUnlock: 'bio_luminescence' },
  },
  gravity_anomaly: {
    surface_survey: { researchPoints: 90 },
    initial_dig: { researchPoints: 200, exoticMaterials: 5 },
    deep_excavation: { researchPoints: 350, exoticMaterials: 20 },
    artefact_recovery: { researchPoints: 550, exoticMaterials: 35, techUnlock: 'gravity_lens' },
  },
  ancient_beacon: {
    surface_survey: { researchPoints: 100 },
    initial_dig: { researchPoints: 250, exoticMaterials: 10 },
    deep_excavation: { researchPoints: 450, exoticMaterials: 25 },
    artefact_recovery: { researchPoints: 700, exoticMaterials: 45, techUnlock: 'beacon_network' },
  },
};

// ---------------------------------------------------------------------------
// Anomaly name/description templates
// ---------------------------------------------------------------------------

const ANOMALY_NAMES: Record<AnomalyType, string[]> = {
  precursor_ruins: [
    'Shattered Citadel', 'Sunken Archives', 'Obsidian Spire Complex',
    'Calcified Command Centre', 'Buried Resonance Chamber',
  ],
  derelict_vessel: [
    'Drifting Hulk', 'Silent Leviathan', 'Corroded Patrol Craft',
    'Fossilised Carrier', 'Gutted Scout',
  ],
  spatial_rift: [
    'Flickering Tear', 'Whispering Void', 'Chromatic Fissure',
    'Dimensional Scar', 'Phase Blister',
  ],
  mineral_deposit: [
    'Crystalline Vein', 'Deep Ore Pocket', 'Iridescent Seam',
    'Compressed Alloy Stratum', 'Volcanic Mineral Bloom',
  ],
  energy_signature: [
    'Pulsating Node', 'Ghost Frequency', 'Decaying Power Core',
    'Harmonic Resonance Field', 'Subterranean Arc Source',
  ],
  sealed_wormhole: [
    'Collapsed Transit', 'Fused Gateway', 'Dormant Aperture',
    'Cauterised Passage', 'Sealed Conduit',
  ],
  debris_field: [
    'Shrapnel Cloud', 'Ancient Battlefield', 'Twisted Wreckage Belt',
    'Scattered Hulls', 'Fragmentation Zone',
  ],
  living_nebula: [
    'Luminous Bloom', 'Breathing Mist', 'Sentient Haze',
    'Pulsing Cloud', 'Bioluminescent Veil',
  ],
  gravity_anomaly: [
    'Density Knot', 'Warped Pocket', 'Gravitational Eddy',
    'Mass Shadow', 'Tidal Nexus',
  ],
  ancient_beacon: [
    'Wailing Signal', 'Amber Pulse Emitter', 'Forgotten Relay',
    'Deep-Space Marker', 'Precursor Lighthouse',
  ],
};

const ANOMALY_DESCRIPTIONS: Record<AnomalyType, string> = {
  precursor_ruins:
    'Crumbling structures of non-terrestrial origin. Initial scans suggest occupation spanning millennia before sudden abandonment.',
  derelict_vessel:
    'A vessel of unknown provenance, drifting without power. Hull composition does not match any known species.',
  spatial_rift:
    'A localised distortion in the fabric of space-time. Instruments register impossible readings near the boundary.',
  mineral_deposit:
    'Concentrated mineral formations of exceptional purity, far exceeding natural geological processes.',
  energy_signature:
    'Persistent energy emissions from an unknown source. The frequency does not correspond to any catalogued phenomenon.',
  sealed_wormhole:
    'A wormhole terminus that has been deliberately collapsed. Residual tachyon traces suggest intentional closure.',
  debris_field:
    'Wreckage from a conflict of staggering scale. Metallurgical dating places the battle thousands of years in the past.',
  living_nebula:
    'A nebular formation exhibiting coordinated movement patterns inconsistent with stellar wind alone.',
  gravity_anomaly:
    'A region where gravitational constants deviate from predicted values. The effect is stable and self-sustaining.',
  ancient_beacon:
    'An automated signal repeating on frequencies that predate all known civilisations in this sector.',
};

// ---------------------------------------------------------------------------
// Precursor lore fragments — gradually reveal the Devourer threat
// ---------------------------------------------------------------------------

/**
 * Lore fragments are indexed 0–14. Lower indices are discovered earlier
 * (surface surveys); higher indices require deep excavation or artefact
 * recovery. Together they paint a picture of a 100+ world empire that
 * came terrifyingly close to defeating the Devourers before falling.
 */
const PRECURSOR_LORE: string[] = [
  // 0 – Surface-level hints
  'Translation fragment: "…the Concord of Aethon spanned one hundred and twelve worlds, ' +
  'bound not by conquest but by a shared dread of what moved between the stars…"',

  // 1
  'Recovered mural depicts a galactic map with over a hundred inhabited systems connected ' +
  'by shimmering transit lines. Several outer systems are marked with a glyph that recurs ' +
  'obsessively — our linguists translate it as "consumed".',

  // 2 – Initial dig revelations
  'Data-crystal playback: "Cycle 4,017. The outer marches have gone silent. Aethon Prime ' +
  'has ordered a full sensor blackout — they believe the Devourers track our emissions."',

  // 3
  'Fragmentary engineering schematics for a device labelled "Resonance Aegis". Margin ' +
  'annotations read: "If the harmonic frequency can be sustained across all relay stations ' +
  'simultaneously, the Devourers\' consumption field may be reflected back upon itself."',

  // 4
  'Autopsy records of Aethon scientists who died investigating recovered Devourer tissue. ' +
  'The tissue is described as "neither organic nor synthetic — a third category entirely, ' +
  'one that reorganises matter at the atomic level to feed".',

  // 5 – Deep excavation
  'Strategic briefing transcript: "We have confirmed that the Devourers do not merely ' +
  'harvest worlds — they unmake them. The mass of Verath VII has decreased by 0.3 % since ' +
  'the swarm arrived. At this rate the planet will cease to exist within four centuries."',

  // 6
  'Personal journal of Fleet Admiral Korath: "The Resonance Aegis prototype was tested at ' +
  'Outpost Seren. The initial pulse drove the nearest Devourer tendril back seventeen ' +
  'light-seconds. For the first time in living memory, they retreated. Hope is a dangerous ' +
  'thing."',

  // 7
  'Manufacturing records show the Concord began constructing Resonance Aegis relays across ' +
  'all 112 worlds. Each relay required exotic materials found only in spatial rifts — the ' +
  'same rifts the Devourers are drawn to. A terrible irony.',

  // 8 – Late deep excavation
  'Intercepted Devourer signal analysis: "The emissions are not communication. They are ' +
  'coordination — a single distributed intelligence directing billions of consumption nodes. ' +
  'If we could disrupt the coordination layer, the swarm would fragment."',

  // 9
  'War council minutes: "Relay 87 of 112 is operational. We need twenty-five more and ' +
  'perhaps three cycles to calibrate the network. Intelligence suggests the Devourers have ' +
  'altered course toward Aethon Prime. They know what we are building."',

  // 10 – Artefact recovery
  'Final broadcast from Aethon Prime, partially corrupted: "Relay 109 online. Three remain. ' +
  'The Devourer vanguard has entered the inner systems. We are committing the entire Home ' +
  'Fleet to buy time. If the Aegis fires, none of this will have been in vain."',

  // 11
  'Post-mortem analysis recovered from a shielded bunker: "Relay 112 was never completed. ' +
  'The exotic materials shipment from the Verath Rift was intercepted by a Devourer tendril. ' +
  'The Aegis fired at 98.2 % capacity. It was not enough."',

  // 12
  'Encrypted addendum to the Concord archives: "The 98.2 % pulse wounded the Devourer ' +
  'coordination layer. For eleven days the swarm was disoriented. Worlds on the periphery ' +
  'evacuated billions. Then the coordination reformed, stronger, and Aethon Prime fell in ' +
  'a single rotation."',

  // 13
  'Hidden data vault containing the complete Resonance Aegis schematics and calibration ' +
  'formulae. A final annotation reads: "To whoever finds this — the Aegis works. It simply ' +
  'needs all 112 relays. We were three worlds short. Do not make our mistake."',

  // 14
  'The innermost vault yields a star chart of every known Devourer incursion path and a ' +
  'predictive model for their next cycle of expansion. According to the Concord\'s ' +
  'calculations, that cycle begins within our lifetime.',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Pick a random element from an array using the provided RNG. */
function pickRandom<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Weighted random selection. Returns the chosen item's type. */
function weightedPick<T extends { type: string; weight: number }>(
  items: readonly T[],
  rng: () => number,
): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let roll = rng() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

/** Return the next excavation stage in sequence. */
function nextStage(current: ExcavationStage): ExcavationStage {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return 'complete';
  return STAGE_ORDER[idx + 1];
}

/** Build default progressPerStage ticks for a new excavation site. */
function defaultProgress(anomalyType: AnomalyType, rng: () => number): Record<ExcavationStage, number> {
  const variance = (base: number) => Math.max(1, Math.round(base * (0.8 + rng() * 0.4)));
  return {
    undiscovered: 0,
    detected: 0,
    surface_survey: variance(STAGE_DURATIONS.surface_survey),
    initial_dig: variance(STAGE_DURATIONS.initial_dig),
    deep_excavation: variance(STAGE_DURATIONS.deep_excavation),
    artefact_recovery: variance(STAGE_DURATIONS.artefact_recovery),
    complete: 0,
  };
}

/** Deep-copy an ExcavationSite. */
function copySite(site: ExcavationSite): ExcavationSite {
  return {
    ...site,
    loreFragments: [...site.loreFragments],
    progressPerStage: { ...site.progressPerStage },
    rewards: site.rewards ? { ...site.rewards } : undefined,
  };
}

/** Merge two AnomalyReward objects by summing numeric fields and keeping strings. */
function mergeRewards(a: AnomalyReward, b: AnomalyReward): AnomalyReward {
  return {
    researchPoints: (a.researchPoints ?? 0) + (b.researchPoints ?? 0) || undefined,
    minerals: (a.minerals ?? 0) + (b.minerals ?? 0) || undefined,
    rareElements: (a.rareElements ?? 0) + (b.rareElements ?? 0) || undefined,
    exoticMaterials: (a.exoticMaterials ?? 0) + (b.exoticMaterials ?? 0) || undefined,
    techUnlock: b.techUnlock ?? a.techUnlock,
    loreFragment: b.loreFragment ?? a.loreFragment,
  };
}

// ---------------------------------------------------------------------------
// Public API — anomaly generation
// ---------------------------------------------------------------------------

/**
 * Generate anomalies for a star system during galaxy generation.
 *
 * Each planet in the system has an independent chance to spawn each anomaly
 * type. Richer and more unusual planets attract more anomalies.
 *
 * @param systemId - ID of the star system.
 * @param planets  - Planets within the system.
 * @param rng      - Seedable random number generator for deterministic output.
 * @returns Array of newly created Anomaly objects (undiscovered).
 */
export function generateAnomaliesForSystem(
  systemId: string,
  planets: readonly Planet[],
  rng: () => number = Math.random,
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  for (const planet of planets) {
    // Richer planets and exotic types have a higher chance of anomalies
    const richnessMod = planet.naturalResources / 100; // 0–1
    const typeMod = ['volcanic', 'barren', 'toxic'].includes(planet.type) ? 1.3 : 1.0;

    const types = Object.keys(ANOMALY_SPAWN_CHANCES) as AnomalyType[];
    for (const anomalyType of types) {
      const baseChance = ANOMALY_SPAWN_CHANCES[anomalyType];
      const adjustedChance = baseChance * (0.5 + richnessMod * 0.5) * typeMod;

      if (rng() < adjustedChance) {
        const names = ANOMALY_NAMES[anomalyType];
        anomalies.push({
          id: generateId(),
          type: anomalyType,
          name: pickRandom(names, rng),
          description: ANOMALY_DESCRIPTIONS[anomalyType],
          systemId,
          discovered: false,
          investigated: false,
        });
      }
    }
  }

  return anomalies;
}

// ---------------------------------------------------------------------------
// Public API — planetary scanning
// ---------------------------------------------------------------------------

/**
 * Scan a planet at a given depth, returning results that may contain
 * misinformation if the scanner skill or scan level is insufficient.
 *
 * Accuracy formula: base = scanLevelBase + scannerSkill * 5, clamped 0–100.
 * Below 70 % accuracy, individual data fields may be fabricated.
 *
 * @param planet       - The planet being scanned.
 * @param scanLevel    - Depth of the scan.
 * @param scannerSkill - Skill rating of the scanning officer (1–10).
 * @param rng          - Seedable RNG.
 * @returns A ScanResult whose accuracy indicates data reliability.
 */
export function scanPlanet(
  planet: Planet,
  scanLevel: ScanLevel,
  scannerSkill: number,
  rng: () => number = Math.random,
): ScanResult {
  const scanLevelBases: Record<ScanLevel, number> = {
    basic: 40,
    geological: 55,
    biological: 55,
    anomaly: 65,
  };

  const baseAccuracy = scanLevelBases[scanLevel] + clamp(scannerSkill, 1, 10) * 5;
  // Add small random variance (±5)
  const accuracy = clamp(Math.round(baseAccuracy + (rng() * 10 - 5)), 0, 100);

  const isReliable = accuracy >= 70;

  // Build scan data — may contain misinformation if unreliable
  const data: ScanData = { summary: '' };

  if (scanLevel === 'geological' || scanLevel === 'basic') {
    data.mineralRichness = isReliable
      ? planet.naturalResources
      : clamp(planet.naturalResources + Math.round((rng() - 0.5) * 60), 0, 100);
  }

  if (scanLevel === 'biological') {
    // Bio signatures correlate loosely with atmosphere
    const baseBio = planet.atmosphere === 'oxygen_nitrogen' ? 80
      : planet.atmosphere === 'nitrogen' ? 40
      : planet.atmosphere === 'methane' ? 20
      : 5;
    data.bioSignatures = isReliable
      ? baseBio
      : clamp(baseBio + Math.round((rng() - 0.5) * 50), 0, 100);
  }

  if (scanLevel === 'anomaly') {
    // Detect anomaly types — may produce false positives when unreliable
    const detectable: AnomalyType[] = [];
    const allTypes = Object.keys(ANOMALY_SPAWN_CHANCES) as AnomalyType[];
    for (const t of allTypes) {
      if (rng() < (isReliable ? 0.15 : 0.25)) {
        detectable.push(t);
      }
    }
    data.detectedAnomalies = detectable;
    data.energyReadings = isReliable
      ? Math.round(planet.naturalResources * 0.6)
      : Math.round(planet.naturalResources * 0.6 + (rng() - 0.5) * 40);
  }

  // Compose summary
  const reliabilityNote = isReliable
    ? 'Scan data confidence is high.'
    : 'Warning: scan confidence is below threshold — data may be unreliable.';
  data.summary = `${scanLevel.replace('_', ' ')} scan of ${planet.name}. ${reliabilityNote}`;

  return {
    planetId: planet.id,
    scanLevel,
    accuracy,
    data,
  };
}

// ---------------------------------------------------------------------------
// Public API — excavation lifecycle
// ---------------------------------------------------------------------------

/**
 * Promote an Anomaly to an ExcavationSite and assign a science ship.
 *
 * The site begins at the 'surface_survey' stage. The discovering empire
 * gains exclusive access to the intelligence gathered.
 *
 * @param anomaly       - The anomaly to begin excavating.
 * @param scienceShipId - ID of the science ship being assigned.
 * @param empireId      - Empire that owns the science ship.
 * @param rng           - Seedable RNG.
 * @returns A new ExcavationSite in the surface_survey stage.
 */
export function beginExcavation(
  anomaly: Anomaly,
  scienceShipId: string,
  empireId: string,
  rng: () => number = Math.random,
): ExcavationSite {
  const dangerEntries = DANGER_TABLE[anomaly.type];
  let dangerLevel = 0;
  let dangerType: AnomalyDanger | undefined;

  if (dangerEntries && rng() < 0.5) {
    // 50 % chance the site has a danger component
    const picked = weightedPick(dangerEntries, rng);
    dangerType = picked.type as AnomalyDanger;
    dangerLevel = clamp(Math.round(20 + rng() * 60), 0, 100);
  }

  return {
    ...anomaly,
    discovered: true,
    investigated: false,
    currentStage: 'surface_survey',
    progressPerStage: defaultProgress(anomaly.type, rng),
    dangerLevel,
    dangerType,
    assignedScienceShipId: scienceShipId,
    discoveredByEmpireId: empireId,
    loreFragments: [],
  };
}

/**
 * Advance an excavation site by one tick.
 *
 * If the site is awaiting a player risk choice (danger encountered, no
 * decision yet), progress is paused and no events are emitted.
 *
 * @param site - Current excavation state.
 * @param rng  - Seedable RNG.
 * @returns Updated site and any events generated this tick.
 */
export function progressExcavation(
  site: ExcavationSite,
  rng: () => number = Math.random,
): { site: ExcavationSite; events: AnomalyEvent[] } {
  const updated = copySite(site);
  const events: AnomalyEvent[] = [];

  // Cannot progress if no ship assigned or site is complete
  if (!updated.assignedScienceShipId || updated.currentStage === 'complete') {
    return { site: updated, events };
  }

  // Pause if awaiting a risk-choice decision from the player
  if (updated.dangerLevel > 0 && updated.dangerType && !updated.riskChoice) {
    // Only emit danger event once (when we first detect it at this stage)
    return { site: updated, events };
  }

  // Apply risk choice effects
  if (updated.riskChoice === 'withdraw') {
    // Player chose to withdraw — excavation ends, partial rewards only
    updated.currentStage = 'complete';
    updated.investigated = true;
    events.push({
      type: 'excavation_complete',
      siteId: updated.id,
      totalRewards: updated.rewards ?? {},
    });
    return { site: updated, events };
  }

  if (updated.riskChoice === 'mitigate') {
    // Mitigation adds extra ticks but reduces danger
    updated.dangerLevel = clamp(updated.dangerLevel - 15, 0, 100);
    const currentTicks = updated.progressPerStage[updated.currentStage];
    updated.progressPerStage[updated.currentStage] = currentTicks + 3;
    updated.riskChoice = 'proceed'; // Mitigation converts to proceed after applying
  }

  // Decrement ticks remaining for current stage
  const remaining = updated.progressPerStage[updated.currentStage];
  if (remaining > 0) {
    updated.progressPerStage[updated.currentStage] = remaining - 1;

    events.push({
      type: 'excavation_progress',
      siteId: updated.id,
      stage: updated.currentStage,
      ticksRemaining: remaining - 1,
    });

    // Stage not yet complete
    if (remaining - 1 > 0) {
      return { site: updated, events };
    }
  }

  // Stage has completed — resolve it
  const resolution = resolveExcavationStage(updated, rng);
  const resolved = resolution.site;

  // Apply stage reward
  if (resolution.reward) {
    resolved.rewards = resolved.rewards
      ? mergeRewards(resolved.rewards, resolution.reward)
      : { ...resolution.reward };

    events.push({
      type: 'excavation_stage_complete',
      siteId: resolved.id,
      completedStage: updated.currentStage,
      nextStage: resolved.currentStage,
      reward: resolution.reward,
    });
  }

  // Danger encountered at the new stage?
  if (resolution.danger && resolution.dangerLevel && resolution.dangerLevel > 0) {
    resolved.dangerType = resolution.danger;
    resolved.dangerLevel = resolution.dangerLevel;
    resolved.riskChoice = undefined; // Reset for new decision

    events.push({
      type: 'danger_encountered',
      siteId: resolved.id,
      dangerType: resolution.danger,
      dangerLevel: resolution.dangerLevel,
      requiresChoice: true,
    });
  }

  // Precursor lore fragment?
  if (resolved.type === 'precursor_ruins' || resolved.type === 'ancient_beacon' || resolved.type === 'energy_signature') {
    const fragment = generatePrecursorBreadcrumb(resolved, STAGE_ORDER.indexOf(resolved.currentStage));
    if (fragment) {
      resolved.loreFragments.push(fragment);
      events.push({
        type: 'lore_discovered',
        siteId: resolved.id,
        fragment,
      });
    }
  }

  // Check if excavation is fully complete
  if (resolved.currentStage === 'complete') {
    resolved.investigated = true;
    events.push({
      type: 'excavation_complete',
      siteId: resolved.id,
      totalRewards: resolved.rewards ?? {},
    });
  }

  return { site: resolved, events };
}

/**
 * Resolve the completion of an excavation stage, determining rewards,
 * danger encounters, and advancement to the next stage.
 *
 * @param site - Excavation site whose current stage has just completed.
 * @param rng  - Seedable RNG.
 * @returns Updated site, optional reward, optional danger, optional risk choice prompt.
 */
export function resolveExcavationStage(
  site: ExcavationSite,
  rng: () => number = Math.random,
): {
  site: ExcavationSite;
  reward?: AnomalyReward;
  danger?: AnomalyDanger;
  dangerLevel?: number;
  riskChoice?: undefined;
} {
  const resolved = copySite(site);
  const completedStage = resolved.currentStage;

  // Look up reward for this anomaly type + stage
  const stageRewards = REWARD_TABLES[resolved.type];
  const reward = stageRewards?.[completedStage]
    ? { ...stageRewards[completedStage]! }
    : undefined;

  // Add lore fragment to reward for precursor-related types
  if (reward && (resolved.type === 'precursor_ruins' || resolved.type === 'ancient_beacon')) {
    const stageIdx = STAGE_ORDER.indexOf(completedStage);
    const loreIdx = clamp(stageIdx + Math.floor(rng() * 2), 0, PRECURSOR_LORE.length - 1);
    reward.loreFragment = PRECURSOR_LORE[loreIdx];
  }

  // Advance to next stage
  resolved.currentStage = nextStage(completedStage);

  // Roll for danger at the new stage (only in active excavation stages)
  let danger: AnomalyDanger | undefined;
  let dangerLevel: number | undefined;

  const dangerEntries = DANGER_TABLE[resolved.type];
  if (
    dangerEntries &&
    resolved.currentStage !== 'complete' &&
    resolved.currentStage !== 'undiscovered' &&
    resolved.currentStage !== 'detected'
  ) {
    // Deeper stages have higher danger probability
    const stageIdx = STAGE_ORDER.indexOf(resolved.currentStage);
    const dangerChance = 0.15 + stageIdx * 0.08;

    if (rng() < dangerChance) {
      const picked = weightedPick(dangerEntries, rng);
      danger = picked.type as AnomalyDanger;
      dangerLevel = clamp(Math.round(15 + stageIdx * 12 + rng() * 20), 0, 100);
    }
  }

  return {
    site: resolved,
    reward,
    danger,
    dangerLevel,
  };
}

// ---------------------------------------------------------------------------
// Public API — precursor lore generation
// ---------------------------------------------------------------------------

/**
 * Generate a precursor lore fragment appropriate to the current excavation
 * depth. Earlier fragments provide tantalising hints; later ones reveal the
 * full scope of the Devourer threat and the Concord of Aethon's near-victory.
 *
 * The `currentTick` parameter is used as a secondary index so that multiple
 * sites discovered at different times yield different fragments, preventing
 * the player from seeing duplicates across simultaneous excavations.
 *
 * @param site        - The excavation site generating lore.
 * @param currentTick - Current game tick (used for fragment selection offset).
 * @returns A lore fragment string, or empty string if no new lore is available.
 */
export function generatePrecursorBreadcrumb(
  site: ExcavationSite,
  currentTick: number,
): string {
  const stageIdx = STAGE_ORDER.indexOf(site.currentStage);

  // Map excavation depth to lore tier:
  //   surface_survey   → fragments 0–2
  //   initial_dig      → fragments 2–5
  //   deep_excavation  → fragments 5–9
  //   artefact_recovery → fragments 10–14
  //   other stages     → no lore
  let minIdx: number;
  let maxIdx: number;

  switch (site.currentStage) {
    case 'surface_survey':
      minIdx = 0; maxIdx = 2;
      break;
    case 'initial_dig':
      minIdx = 2; maxIdx = 5;
      break;
    case 'deep_excavation':
      minIdx = 5; maxIdx = 9;
      break;
    case 'artefact_recovery':
      minIdx = 10; maxIdx = 14;
      break;
    default:
      return '';
  }

  // Use currentTick as offset to vary fragment selection across sites
  const offset = currentTick % (maxIdx - minIdx + 1);
  const loreIdx = clamp(minIdx + offset, minIdx, maxIdx);

  const candidate = PRECURSOR_LORE[loreIdx];

  // Avoid duplicates within this site's already-collected fragments
  if (site.loreFragments.includes(candidate)) {
    // Try adjacent fragments
    for (let delta = 1; delta <= maxIdx - minIdx; delta++) {
      const alt = PRECURSOR_LORE[clamp(loreIdx + delta, minIdx, maxIdx)];
      if (!site.loreFragments.includes(alt)) return alt;
      const alt2 = PRECURSOR_LORE[clamp(loreIdx - delta, minIdx, maxIdx)];
      if (!site.loreFragments.includes(alt2)) return alt2;
    }
    return ''; // All fragments in this tier already discovered
  }

  return candidate;
}
