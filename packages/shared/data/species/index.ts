import type { Species } from '../../src/types/species.js';

import vaelori from './vaelori.json' with { type: 'json' };
import khazari from './khazari.json' with { type: 'json' };
import sylvani from './sylvani.json' with { type: 'json' };
import nexari from './nexari.json' with { type: 'json' };
import drakmari from './drakmari.json' with { type: 'json' };
import teranos from './teranos.json' with { type: 'json' };
import zorvathi from './zorvathi.json' with { type: 'json' };
import ashkari from './ashkari.json' with { type: 'json' };
import luminari from './luminari.json' with { type: 'json' };
import vethara from './vethara.json' with { type: 'json' };
import kaelenth from './kaelenth.json' with { type: 'json' };
import thyriaq from './thyriaq.json' with { type: 'json' };
import aethyn from './aethyn.json' with { type: 'json' };
import orivani from './orivani.json' with { type: 'json' };
import pyrenth from './pyrenth.json' with { type: 'json' };
import diplomaticVoicesData from './diplomatic-voices.json' with { type: 'json' };

/** All 15 pre-built species as a typed array. */
export const PREBUILT_SPECIES: Species[] = [
  vaelori,
  khazari,
  sylvani,
  nexari,
  drakmari,
  teranos,
  zorvathi,
  ashkari,
  luminari,
  vethara,
  kaelenth,
  thyriaq,
  aethyn,
  orivani,
  pyrenth,
] as Species[];

/** Lookup map from species ID to Species. */
export const PREBUILT_SPECIES_BY_ID: Readonly<Record<string, Species>> =
  Object.fromEntries(PREBUILT_SPECIES.map((s) => [s.id, s]));

// ---------------------------------------------------------------------------
// Diplomatic voices — species-flavoured dialogue for notifications
// ---------------------------------------------------------------------------

export type DiplomaticVoiceSituation =
  | 'treaty_proposal'
  | 'demand'
  | 'war_declaration'
  | 'peace_offer'
  | 'vassalage_offer'
  | 'vassalage_demand';

interface VoiceEntry { title: string; body: string }

/** Raw diplomatic voice data keyed by species ID then situation. */
export const DIPLOMATIC_VOICES: Readonly<Record<string, Record<string, VoiceEntry>>> =
  diplomaticVoicesData as Record<string, Record<string, VoiceEntry>>;

/**
 * Return species-flavoured title and body for a diplomatic notification.
 *
 * Placeholders `{name}`, `{target}` and `{treaty_type}` in the voice data
 * are replaced with the supplied values.  Falls back to a generic message
 * when the species or situation is missing.
 */
export function getDiplomaticVoice(
  speciesId: string,
  situation: DiplomaticVoiceSituation,
  vars: { name: string; target: string; treaty_type?: string },
): { title: string; body: string } {
  const voices = DIPLOMATIC_VOICES[speciesId];
  if (!voices?.[situation]) {
    return {
      title: `${vars.name} — diplomatic message`,
      body: `A diplomatic communication from ${vars.name}.`,
    };
  }
  const voice = voices[situation];
  const replace = (s: string) =>
    s
      .replace(/\{name\}/g, vars.name)
      .replace(/\{target\}/g, vars.target)
      .replace(/\{treaty_type\}/g, vars.treaty_type ?? '');
  return { title: replace(voice.title), body: replace(voice.body) };
}
