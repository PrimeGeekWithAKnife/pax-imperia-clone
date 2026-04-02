import type { SpeciesPersonalityData, AffinityMatrix } from '../../../src/types/psychology.js';

import teranos from './teranos.json' with { type: 'json' };
import khazari from './khazari.json' with { type: 'json' };
import sylvani from './sylvani.json' with { type: 'json' };
import nexari from './nexari.json' with { type: 'json' };
import drakmari from './drakmari.json' with { type: 'json' };
import orivani from './orivani.json' with { type: 'json' };
import pyrenth from './pyrenth.json' with { type: 'json' };
import luminari from './luminari.json' with { type: 'json' };
import vethara from './vethara.json' with { type: 'json' };
import ashkari from './ashkari.json' with { type: 'json' };
import zorvathi from './zorvathi.json' with { type: 'json' };
import kaelenth from './kaelenth.json' with { type: 'json' };
import thyriaq from './thyriaq.json' with { type: 'json' };
import aethyn from './aethyn.json' with { type: 'json' };
import vaelori from './vaelori.json' with { type: 'json' };

import affinityData from '../affinity-matrix.json' with { type: 'json' };

/** All 15 species personality data files as a typed array. */
export const SPECIES_PERSONALITIES: SpeciesPersonalityData[] = [
  teranos,
  khazari,
  sylvani,
  nexari,
  drakmari,
  orivani,
  pyrenth,
  luminari,
  vethara,
  ashkari,
  zorvathi,
  kaelenth,
  thyriaq,
  aethyn,
  vaelori,
] as SpeciesPersonalityData[];

/** Lookup map from species ID to personality data. */
export const SPECIES_PERSONALITIES_BY_ID: Readonly<Record<string, SpeciesPersonalityData>> =
  Object.fromEntries(SPECIES_PERSONALITIES.map(p => [p.speciesId, p]));

/** The species-pair affinity matrix. */
export const AFFINITY_MATRIX: AffinityMatrix = affinityData as AffinityMatrix;
