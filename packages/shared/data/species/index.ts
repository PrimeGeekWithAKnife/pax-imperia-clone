import type { Species } from '../../src/types/species.js';

import vaelori from './vaelori.json' with { type: 'json' };
import khazari from './khazari.json' with { type: 'json' };
import sylvani from './sylvani.json' with { type: 'json' };
import nexari from './nexari.json' with { type: 'json' };
import drakmari from './drakmari.json' with { type: 'json' };
import teranos from './teranos.json' with { type: 'json' };
import zorvathi from './zorvathi.json' with { type: 'json' };
import ashkari from './ashkari.json' with { type: 'json' };

/** All 8 pre-built species as a typed array. */
export const PREBUILT_SPECIES: Species[] = [
  vaelori,
  khazari,
  sylvani,
  nexari,
  drakmari,
  teranos,
  zorvathi,
  ashkari,
] as Species[];

/** Lookup map from species ID to Species. */
export const PREBUILT_SPECIES_BY_ID: Readonly<Record<string, Species>> =
  Object.fromEntries(PREBUILT_SPECIES.map((s) => [s.id, s]));
