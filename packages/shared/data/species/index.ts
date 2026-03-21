import type { Species } from '../../src/types/species.js';

import vaelori from './vaelori.json' assert { type: 'json' };
import khazari from './khazari.json' assert { type: 'json' };
import sylvani from './sylvani.json' assert { type: 'json' };
import nexari from './nexari.json' assert { type: 'json' };
import drakmari from './drakmari.json' assert { type: 'json' };
import teranos from './teranos.json' assert { type: 'json' };
import zorvathi from './zorvathi.json' assert { type: 'json' };
import ashkari from './ashkari.json' assert { type: 'json' };

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
