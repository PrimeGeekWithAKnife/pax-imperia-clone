import type { StarterFactionDefinition } from '../../src/types/politics.js';

import starterFactions from './starter-factions.json' with { type: 'json' };

/** All starter faction definitions, typed. */
export const STARTER_FACTIONS: StarterFactionDefinition[] =
  starterFactions as StarterFactionDefinition[];

/** Lookup: species ID -> starter factions for that species. */
export const STARTER_FACTIONS_BY_SPECIES: Readonly<
  Record<string, StarterFactionDefinition[]>
> = STARTER_FACTIONS.reduce(
  (acc, f) => {
    (acc[f.speciesId] ??= []).push(f);
    return acc;
  },
  {} as Record<string, StarterFactionDefinition[]>,
);

/** Lookup: faction ID -> starter faction definition. */
export const STARTER_FACTIONS_BY_ID: Readonly<
  Record<string, StarterFactionDefinition>
> = Object.fromEntries(STARTER_FACTIONS.map((f) => [f.id, f]));
