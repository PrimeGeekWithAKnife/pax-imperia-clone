import type { AnomalyRewardTemplate } from '../../src/types/anomaly.js';

import rewardsData from '../anomaly-rewards.json' with { type: 'json' };

/** All anomaly reward templates as a typed array. */
export const ANOMALY_REWARD_TEMPLATES: AnomalyRewardTemplate[] =
  rewardsData as unknown as AnomalyRewardTemplate[];

/** Lookup map from anomaly type to its reward template. */
export const ANOMALY_REWARD_BY_TYPE: Readonly<Record<string, AnomalyRewardTemplate>> =
  Object.fromEntries(ANOMALY_REWARD_TEMPLATES.map((t) => [t.type, t]));
