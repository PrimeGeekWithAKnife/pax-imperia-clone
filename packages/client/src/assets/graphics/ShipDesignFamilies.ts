/**
 * ShipDesignFamilies.ts
 * Per-species ship wireframe renderers for the ship designer.
 * Individual species renderers are in ./ships/{species}.ts
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type DesignFamily = 'organic' | 'angular' | 'crystalline' | 'mechanical' | 'practical';

type FamilyDrawFn = (ctx: CanvasRenderingContext2D, accent: string) => void;

// ── Species -> family mapping ───────────────────────────────────────────────

export const SPECIES_DESIGN_FAMILY: Record<string, DesignFamily> = {
  sylvani:  'organic',      drakmari: 'organic',      vethara:  'organic',
  khazari:  'angular',      orivani:  'angular',      pyrenth:  'angular',
  vaelori:  'crystalline',  luminari: 'crystalline',   aethyn:   'crystalline',
  nexari:   'mechanical',   kaelenth: 'mechanical',    thyriaq:  'mechanical',
  teranos:  'practical',    ashkari:  'practical',     zorvathi: 'practical',
};

export function getDesignFamily(speciesId?: string): DesignFamily {
  if (!speciesId) return 'practical';
  return SPECIES_DESIGN_FAMILY[speciesId] ?? 'practical';
}

// ── Per-species wireframe imports ───────────────────────────────────────────

import {
  teranosScout, teranosDestroyer, teranosTransport,
  teranosCruiser, teranosCarrier, teranosBattleship, teranosColoniser,
} from './ships/teranos';
import {
  khazariScout, khazariDestroyer, khazariTransport,
  khazariCruiser, khazariCarrier, khazariBattleship, khazariColoniser,
} from './ships/khazari';
import {
  vaeloriScout, vaeloriDestroyer, vaeloriTransport,
  vaeloriCruiser, vaeloriCarrier, vaeloriBattleship, vaeloriColoniser,
} from './ships/vaelori';
import {
  sylvaniScout, sylvaniDestroyer, sylvaniTransport,
  sylvaniCruiser, sylvaniCarrier, sylvaniBattleship, sylvaniColoniser,
} from './ships/sylvani';
import {
  nexariScout, nexariDestroyer, nexariTransport,
  nexariCruiser, nexariCarrier, nexariBattleship, nexariColoniser,
} from './ships/nexari';
import {
  drakmariScout, drakmariDestroyer, drakmariTransport,
  drakmariCruiser, drakmariCarrier, drakmariBattleship, drakmariColoniser,
} from './ships/drakmari';
import {
  ashkariScout, ashkariDestroyer, ashkariTransport,
  ashkariCruiser, ashkariCarrier, ashkariBattleship, ashkariColoniser,
} from './ships/ashkari';
import {
  luminariScout, luminariDestroyer, luminariTransport,
  luminariCruiser, luminariCarrier, luminariBattleship, luminariColoniser,
} from './ships/luminari';
import {
  zorvathiScout, zorvathiDestroyer, zorvathiTransport,
  zorvathiCruiser, zorvathiCarrier, zorvathiBattleship, zorvathiColoniser,
} from './ships/zorvathi';
import {
  orivaniScout, orivaniDestroyer, orivaniTransport,
  orivaniCruiser, orivaniCarrier, orivaniBattleship, orivaniColoniser,
} from './ships/orivani';
import {
  kaelenthScout, kaelenthDestroyer, kaelenthTransport,
  kaelenthCruiser, kaelenthCarrier, kaelenthBattleship, kaelenthColoniser,
} from './ships/kaelenth';
import {
  thyriaqScout, thyriaqDestroyer, thyriaqTransport,
  thyriaqCruiser, thyriaqCarrier, thyriaqBattleship, thyriaqColoniser,
} from './ships/thyriaq';
import {
  aethynScout, aethynDestroyer, aethynTransport,
  aethynCruiser, aethynCarrier, aethynBattleship, aethynColoniser,
} from './ships/aethyn';
import {
  vetharaScout, vetharaDestroyer, vetharaTransport,
  vetharaCruiser, vetharaCarrier, vetharaBattleship, vetharaColoniser,
} from './ships/vethara';
import {
  pyrenthScout, pyrenthDestroyer, pyrenthTransport,
  pyrenthCruiser, pyrenthCarrier, pyrenthBattleship, pyrenthColoniser,
} from './ships/pyrenth';

// ── Species draw function lookup ────────────────────────────────────────────

type HullDrawMap = Record<string, FamilyDrawFn>;

const SPECIES_DRAW_FNS: Record<string, HullDrawMap> = {
  teranos: {
    scout: teranosScout, destroyer: teranosDestroyer, transport: teranosTransport,
    cruiser: teranosCruiser, carrier: teranosCarrier, battleship: teranosBattleship,
    coloniser: teranosColoniser,
  },
  khazari: {
    scout: khazariScout, destroyer: khazariDestroyer, transport: khazariTransport,
    cruiser: khazariCruiser, carrier: khazariCarrier, battleship: khazariBattleship,
    coloniser: khazariColoniser,
  },
  vaelori: {
    scout: vaeloriScout, destroyer: vaeloriDestroyer, transport: vaeloriTransport,
    cruiser: vaeloriCruiser, carrier: vaeloriCarrier, battleship: vaeloriBattleship,
    coloniser: vaeloriColoniser,
  },
  sylvani: {
    scout: sylvaniScout, destroyer: sylvaniDestroyer, transport: sylvaniTransport,
    cruiser: sylvaniCruiser, carrier: sylvaniCarrier, battleship: sylvaniBattleship,
    coloniser: sylvaniColoniser,
  },
  nexari: {
    scout: nexariScout, destroyer: nexariDestroyer, transport: nexariTransport,
    cruiser: nexariCruiser, carrier: nexariCarrier, battleship: nexariBattleship,
    coloniser: nexariColoniser,
  },
  drakmari: {
    scout: drakmariScout, destroyer: drakmariDestroyer, transport: drakmariTransport,
    cruiser: drakmariCruiser, carrier: drakmariCarrier, battleship: drakmariBattleship,
    coloniser: drakmariColoniser,
  },
  ashkari: {
    scout: ashkariScout, destroyer: ashkariDestroyer, transport: ashkariTransport,
    cruiser: ashkariCruiser, carrier: ashkariCarrier, battleship: ashkariBattleship,
    coloniser: ashkariColoniser,
  },
  luminari: {
    scout: luminariScout, destroyer: luminariDestroyer, transport: luminariTransport,
    cruiser: luminariCruiser, carrier: luminariCarrier, battleship: luminariBattleship,
    coloniser: luminariColoniser,
  },
  zorvathi: {
    scout: zorvathiScout, destroyer: zorvathiDestroyer, transport: zorvathiTransport,
    cruiser: zorvathiCruiser, carrier: zorvathiCarrier, battleship: zorvathiBattleship,
    coloniser: zorvathiColoniser,
  },
  orivani: {
    scout: orivaniScout, destroyer: orivaniDestroyer, transport: orivaniTransport,
    cruiser: orivaniCruiser, carrier: orivaniCarrier, battleship: orivaniBattleship,
    coloniser: orivaniColoniser,
  },
  kaelenth: {
    scout: kaelenthScout, destroyer: kaelenthDestroyer, transport: kaelenthTransport,
    cruiser: kaelenthCruiser, carrier: kaelenthCarrier, battleship: kaelenthBattleship,
    coloniser: kaelenthColoniser,
  },
  thyriaq: {
    scout: thyriaqScout, destroyer: thyriaqDestroyer, transport: thyriaqTransport,
    cruiser: thyriaqCruiser, carrier: thyriaqCarrier, battleship: thyriaqBattleship,
    coloniser: thyriaqColoniser,
  },
  aethyn: {
    scout: aethynScout, destroyer: aethynDestroyer, transport: aethynTransport,
    cruiser: aethynCruiser, carrier: aethynCarrier, battleship: aethynBattleship,
    coloniser: aethynColoniser,
  },
  vethara: {
    scout: vetharaScout, destroyer: vetharaDestroyer, transport: vetharaTransport,
    cruiser: vetharaCruiser, carrier: vetharaCarrier, battleship: vetharaBattleship,
    coloniser: vetharaColoniser,
  },
  pyrenth: {
    scout: pyrenthScout, destroyer: pyrenthDestroyer, transport: pyrenthTransport,
    cruiser: pyrenthCruiser, carrier: pyrenthCarrier, battleship: pyrenthBattleship,
    coloniser: pyrenthColoniser,
  },
};

/**
 * Look up a species-specific or family-level draw function for a hull class.
 * Returns null if no override (falls through to default ShipGraphics renderer).
 */
export function getFamilyDrawFn(
  hullClass: string,
  family: DesignFamily,
  speciesId?: string,
): FamilyDrawFn | null {
  // Prefer per-species if available
  if (speciesId && SPECIES_DRAW_FNS[speciesId]) {
    return SPECIES_DRAW_FNS[speciesId][hullClass] ?? null;
  }
  return null;
}
