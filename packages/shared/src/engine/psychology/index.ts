export {
  gaussian,
  rollTrait,
  rollCoreTraits,
  rollSubfacets,
  rollDarkTriad,
  rollFirstContactAttitude,
  rollPersonality,
  createDefaultPersonality,
} from './personality.js';

export {
  traitSimilarity,
  darkTriadPenalty,
  computeCompatibility,
  lookupBaseAffinity,
  computeTotalCompatibility,
} from './compatibility.js';

export {
  NEUTRAL_MOOD,
  applyMoodEvent,
  decayMood,
  processMoodTick,
} from './mood.js';
export type { MoodEvent } from './mood.js';

export {
  computeMaslowNeeds,
  lowestUnmetNeed,
  criticalNeedOverride,
  belongingDeprivationImpact,
} from './maslow.js';
export type { EmpireStateSnapshot } from './maslow.js';

export {
  computeStressLevel,
  applyEnneagramDisintegration,
  applyEnneagramGrowth,
  determineCopingStrategy,
} from './stress.js';
export type { StressInput } from './stress.js';

export {
  initPsychologicalState,
  processPsychologyTick,
} from './tick.js';

export {
  RELATIONSHIP_EVENTS,
  createRelationship,
  applyRelationshipEvent,
  tickRelationship,
  computeOverallSentiment,
  isRelationshipHostile,
  isRelationshipAllianceReady,
} from './relationship.js';
