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

export {
  sigmoid,
  computeAcceptanceProbability,
  probabilisticDecision,
  evaluateProposal,
  computeNeedAlignment,
  generateDiplomaticActions,
  proposalFrequency,
} from './evaluation.js';
export type { ProposalContext, EvaluableTreatyType, DiplomaticAction } from './evaluation.js';

export {
  evaluateTreatyWithPsychology,
  psychologyWarPropensity,
  determineBuildingPriorities,
  generatePsychDiplomaticActions,
  computePersonalityDrift,
} from './ai-integration.js';
export type { BuildingPriority } from './ai-integration.js';

export {
  createSenateState,
  submitMembershipApplication,
  voteOnApplication,
  resolveApplication,
  startElection,
  voteInElection,
  resolveElection,
  aiVoteOnMembership,
  aiVoteInElection,
  senateRelationshipEvents,
  processSenateTick,
} from './senate.js';
export type { SenateAction, SenateTickEvent } from './senate.js';
