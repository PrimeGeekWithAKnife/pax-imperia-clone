/**
 * Psychology System Playtest — Conquest Victory, 8 Races, Medium Galaxy
 *
 * 10 games × 1500 ticks × 8 players, conquest victory only.
 *
 * Key questions:
 *  - Do threatened empires seek alliances for survival (Maslow safety override)?
 *  - Do anxious species panic and over-ally? Do avoidant species hold out too long?
 *  - Does stress cause visible Enneagram shifts (Sylvani→anxious, Khazari→withdrawn)?
 *  - Do high-psychopathy species (Drakmari) wage more wars?
 *  - Does the psychology produce meaningfully different conquest dynamics?
 *  - Do alliances form under pressure that wouldn't form in peacetime?
 */

import { describe, it, expect } from 'vitest';
import { initializeGame, type GameSetupConfig } from '../engine/game-init.js';
import {
  processGameTick,
  initializeTickState,
} from '../engine/game-loop.js';
import { PREBUILT_SPECIES_BY_ID } from '../../data/species/index.js';
import techTreeData from '../../data/tech/universal-tree.json';
import type { Technology } from '../types/technology.js';
import type { EmpirePsychologicalState } from '../types/psychology.js';

const allTechs = (techTreeData as unknown as { technologies: Technology[] }).technologies;
const MAX_TICKS = 1500;

/** All 15 species IDs for random selection. */
const ALL_SPECIES = [
  'teranos', 'khazari', 'drakmari', 'sylvani', 'nexari', 'orivani',
  'pyrenth', 'luminari', 'vethara', 'ashkari', 'zorvathi', 'kaelenth',
  'thyriaq', 'aethyn', 'vaelori',
];

const COLOURS = ['#4488ff', '#ff4444', '#44ff44', '#ffaa00', '#aa44ff', '#44ffff', '#ff44aa', '#aaffaa'];

/**
 * 10 game configs — each picks 8 species with different mixes.
 * Some deliberately provocative (predators + pacifists), others random.
 */
const GAME_CONFIGS: { label: string; species: string[]; seed: number }[] = [
  {
    label: 'Classic 8',
    species: ['teranos', 'khazari', 'drakmari', 'sylvani', 'nexari', 'vethara', 'luminari', 'orivani'],
    seed: 11001,
  },
  {
    label: 'Predators vs pacifists',
    species: ['drakmari', 'khazari', 'orivani', 'thyriaq', 'sylvani', 'luminari', 'aethyn', 'vaelori'],
    seed: 22002,
  },
  {
    label: 'Hive minds & machines',
    species: ['nexari', 'zorvathi', 'kaelenth', 'thyriaq', 'teranos', 'ashkari', 'pyrenth', 'vethara'],
    seed: 33003,
  },
  {
    label: 'All the anxiety',
    species: ['vethara', 'orivani', 'ashkari', 'teranos', 'drakmari', 'nexari', 'sylvani', 'khazari'],
    seed: 44004,
  },
  {
    label: 'Silicon vs carbon',
    species: ['khazari', 'pyrenth', 'kaelenth', 'zorvathi', 'teranos', 'vethara', 'sylvani', 'drakmari'],
    seed: 55005,
  },
  {
    label: 'Mystics & brutes',
    species: ['vaelori', 'aethyn', 'luminari', 'orivani', 'drakmari', 'khazari', 'zorvathi', 'thyriaq'],
    seed: 66006,
  },
  {
    label: 'Diplomats under siege',
    species: ['teranos', 'sylvani', 'vethara', 'ashkari', 'luminari', 'drakmari', 'khazari', 'nexari'],
    seed: 77007,
  },
  {
    label: 'Dark Triad showdown',
    species: ['drakmari', 'kaelenth', 'thyriaq', 'nexari', 'orivani', 'khazari', 'teranos', 'pyrenth'],
    seed: 88008,
  },
  {
    label: 'Galactic melting pot',
    species: ['teranos', 'aethyn', 'zorvathi', 'vethara', 'pyrenth', 'orivani', 'luminari', 'kaelenth'],
    seed: 99009,
  },
  {
    label: 'Attachment extremes',
    species: ['sylvani', 'teranos', 'luminari', 'aethyn', 'khazari', 'pyrenth', 'drakmari', 'thyriaq'],
    seed: 10100,
  },
];

interface ConquestResult {
  label: string;
  finalTick: number;
  winner: string | null;
  winnerAttachment: string | null;
  victoryType: string | null;
  gameFinished: boolean;
  warsDeclared: number;
  combatEvents: number;
  planetsConquered: number;
  alliancesAtEnd: number;
  empiresEliminated: number;
  survivalAlliances: number;
  speciesStats: Record<string, {
    attachment: string;
    planets: number;
    ships: number;
    allies: number;
    wars: number;
    mood: number;
    stress: string;
    safety: number;
    belonging: number;
    alive: boolean;
  }>;
}

function runConquestGame(cfg: typeof GAME_CONFIGS[0]): ConquestResult {
  const species = cfg.species.map(id => PREBUILT_SPECIES_BY_ID[id]);

  const config: GameSetupConfig = {
    galaxyConfig: {
      shape: 'spiral' as const,
      size: 'medium' as const,
      density: 'normal' as const,
      playerCount: 8,
      seed: cfg.seed,
    },
    players: species.map((sp, i) => ({
      empireName: sp.name,
      species: sp,
      color: COLOURS[i],
      isAI: true,
    })),
    victoryCriteria: ['conquest'],
  };

  const gameState = initializeGame(config);
  let state = initializeTickState(gameState);
  const empireIds = gameState.empires.map(e => e.id);

  let winner: string | null = null;
  let victoryType: string | null = null;
  let gameFinished = false;
  let warsDeclared = 0;
  let combatEvents = 0;
  let planetsConquered = 0;

  for (let t = 0; t < MAX_TICKS; t++) {
    const result = processGameTick(state, allTechs);
    state = result.newState;

    for (const evt of result.events) {
      const e = evt as Record<string, unknown>;
      if (e.type === 'GameOver') {
        winner = e.winnerEmpireId as string;
        victoryType = e.victoryCriteria as string;
        gameFinished = true;
      }
      if (e.type === 'CombatResolved' || e.type === 'CombatStarted') combatEvents++;
    }
    if (state.gameState.status === 'finished') gameFinished = true;

    // Count captures and wars from notifications (not GameEvents)
    const notifications = ((state as unknown as Record<string, unknown>).notifications ?? []) as Array<Record<string, unknown>>;
    for (const n of notifications) {
      if (n.type === 'planet_captured') planetsConquered++;
      if (n.type === 'war_declared') warsDeclared++;
    }

    // Detailed log at milestones
    if ([499, 999, 1499].includes(t)) {
      console.log(`  t=${t + 1}:`);
      const psychMap = ((state as unknown as Record<string, unknown>).psychStateMap ?? new Map()) as
        Map<string, EmpirePsychologicalState>;

      for (const emp of state.gameState.empires) {
        const planets = state.gameState.galaxy.systems
          .flatMap(s => s.planets)
          .filter(p => p.ownerId === emp.id);
        const ships = state.gameState.fleets
          .filter(f => f.empireId === emp.id)
          .reduce((sum, f) => sum + f.ships.length, 0);
        const diplo = emp.diplomacy ?? [];
        const allies = diplo.filter(r =>
          r.status === 'allied' || r.treaties?.some(t => (t as Record<string, unknown>).type === 'alliance'),
        ).length;
        const wars = diplo.filter(r => r.status === 'at_war').length;
        const alive = planets.length > 0 || ships > 0;

        const psych = psychMap.get(emp.id);
        const attach = psych?.personality.attachmentStyle ?? '?';
        const mood = psych?.mood.valence ?? 0;
        const stress = psych?.stressLevel ?? '?';
        const safety = psych?.needs.safety ?? 0;
        const belonging = psych?.needs.belonging ?? 0;
        const rels = psych ? Object.keys(psych.relationships).length : 0;

        const status = alive ? '' : ' [DEAD]';
        console.log(`    ${emp.species.name} [${attach}]${status}: ${planets.length} cols, ${ships} ships, ${allies} allies, ${wars} wars, ${rels} rels | mood=${mood} stress=${stress} safety=${safety} belonging=${belonging}`);
      }
      console.log(`    Cumulative: wars=${warsDeclared} combats=${combatEvents} conquered=${planetsConquered}`);
    }

    if (gameFinished) {
      console.log(`  *** CONQUEST VICTORY at tick ${t + 1} ***`);
      break;
    }
  }

  // Collect end-state
  const psychMap = ((state as unknown as Record<string, unknown>).psychStateMap ?? new Map()) as
    Map<string, EmpirePsychologicalState>;
  const speciesStats: ConquestResult['speciesStats'] = {};
  let empiresEliminated = 0;
  let alliancesAtEnd = 0;
  let survivalAlliances = 0;

  for (const emp of state.gameState.empires) {
    const planets = state.gameState.galaxy.systems.flatMap(s => s.planets).filter(p => p.ownerId === emp.id);
    const ships = state.gameState.fleets.filter(f => f.empireId === emp.id).reduce((sum, f) => sum + f.ships.length, 0);
    const diplo = emp.diplomacy ?? [];
    const allies = diplo.filter(r =>
      r.status === 'allied' || r.treaties?.some(t => (t as Record<string, unknown>).type === 'alliance'),
    ).length;
    const wars = diplo.filter(r => r.status === 'at_war').length;
    const alive = planets.length > 0;
    if (!alive) empiresEliminated++;

    const psych = psychMap.get(emp.id);
    speciesStats[emp.species.name] = {
      attachment: psych?.personality.attachmentStyle ?? 'unknown',
      planets: planets.length,
      ships,
      allies,
      wars,
      mood: psych?.mood.valence ?? 0,
      stress: psych?.stressLevel ?? 'unknown',
      safety: psych?.needs.safety ?? 0,
      belonging: psych?.needs.belonging ?? 0,
      alive,
    };

    if (allies > 0 && wars > 0) survivalAlliances += allies; // Alliances formed while at war
    alliancesAtEnd += allies;
  }
  alliancesAtEnd = Math.round(alliancesAtEnd / 2);

  const winnerSpecies = winner
    ? state.gameState.empires.find(e => e.id === winner)?.species.name ?? winner
    : null;
  const winnerPsych = winner ? psychMap.get(winner) : null;

  return {
    label: cfg.label,
    finalTick: state.gameState.currentTick,
    winner: winnerSpecies,
    winnerAttachment: winnerPsych?.personality.attachmentStyle ?? null,
    victoryType,
    gameFinished,
    warsDeclared,
    combatEvents,
    planetsConquered,
    alliancesAtEnd,
    empiresEliminated,
    survivalAlliances,
    speciesStats,
  };
}

describe('Psychology Playtest: 10 conquest games (1500 ticks, 8 players, medium galaxy)', () => {
  const results: ConquestResult[] = [];

  for (let i = 0; i < GAME_CONFIGS.length; i++) {
    const cfg = GAME_CONFIGS[i];
    it(`Game ${i + 1}: ${cfg.label}`, () => {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`=== Game ${i + 1}: ${cfg.label} ===`);
      console.log(`=== Species: ${cfg.species.join(', ')} ===`);
      console.log(`${'='.repeat(70)}`);

      const result = runConquestGame(cfg);
      results.push(result);

      console.log(`\n  RESULT: ${result.gameFinished
        ? `${result.winner} [${result.winnerAttachment}] wins by ${result.victoryType} at tick ${result.finalTick}`
        : `NO WINNER after ${MAX_TICKS} ticks`}`);
      console.log(`  Wars: ${result.warsDeclared} | Combats: ${result.combatEvents} | Conquered: ${result.planetsConquered}`);
      console.log(`  Alliances at end: ${result.alliancesAtEnd} | Survival alliances: ${result.survivalAlliances} | Eliminated: ${result.empiresEliminated}/8`);
      console.log(`  End-state:`);
      for (const [name, stats] of Object.entries(result.speciesStats)) {
        const status = stats.alive ? `${stats.planets} cols, ${stats.ships} ships` : 'ELIMINATED';
        console.log(`    ${name} [${stats.attachment}]: ${status} | ${stats.allies} allies, ${stats.wars} wars | mood=${stats.mood} stress=${stats.stress} safety=${stats.safety}`);
      }

      expect(result.finalTick).toBeGreaterThan(0);
    }, 300_000);
  }

  it('Summary', () => {
    console.log(`\n${'='.repeat(70)}`);
    console.log('=== CONQUEST PLAYTEST SUMMARY ===');
    console.log(`${'='.repeat(70)}`);

    const victories = results.filter(r => r.gameFinished);
    const totalWars = results.reduce((s, r) => s + r.warsDeclared, 0);
    const totalCombats = results.reduce((s, r) => s + r.combatEvents, 0);
    const totalConquered = results.reduce((s, r) => s + r.planetsConquered, 0);
    const totalAlliances = results.reduce((s, r) => s + r.alliancesAtEnd, 0);
    const totalSurvival = results.reduce((s, r) => s + r.survivalAlliances, 0);
    const totalEliminated = results.reduce((s, r) => s + r.empiresEliminated, 0);

    console.log(`Conquest victories: ${victories.length} / ${results.length}`);
    console.log(`Total wars declared: ${totalWars}`);
    console.log(`Total combats: ${totalCombats}`);
    console.log(`Total planets conquered: ${totalConquered}`);
    console.log(`Total alliances at end: ${totalAlliances}`);
    console.log(`Survival alliances (allied while at war): ${totalSurvival}`);
    console.log(`Total empires eliminated: ${totalEliminated} / ${results.length * 8}`);

    // Winner attachment style distribution
    const winnerStyles: Record<string, number> = {};
    for (const r of victories) {
      const style = r.winnerAttachment ?? 'none';
      winnerStyles[style] = (winnerStyles[style] ?? 0) + 1;
    }
    console.log(`\nWinner attachment styles: ${JSON.stringify(winnerStyles)}`);

    // Per-game summary
    console.log('\nPer-game results:');
    for (const r of results) {
      const status = r.gameFinished
        ? `${r.winner} [${r.winnerAttachment}] wins at t=${r.finalTick}`
        : 'no winner';
      console.log(`  ${r.label}: ${status} | wars=${r.warsDeclared} combats=${r.combatEvents} conquered=${r.planetsConquered} alliances=${r.alliancesAtEnd} eliminated=${r.empiresEliminated}`);
    }

    // Species survival rate across all games
    const speciesSurvival: Record<string, { alive: number; total: number; wins: number }> = {};
    for (const r of results) {
      for (const [name, stats] of Object.entries(r.speciesStats)) {
        if (!speciesSurvival[name]) speciesSurvival[name] = { alive: 0, total: 0, wins: 0 };
        speciesSurvival[name].total++;
        if (stats.alive) speciesSurvival[name].alive++;
        if (r.winner === name) speciesSurvival[name].wins++;
      }
    }
    console.log('\nSpecies survival rates:');
    const sorted = Object.entries(speciesSurvival).sort((a, b) => (b[1].alive / b[1].total) - (a[1].alive / a[1].total));
    for (const [name, stats] of sorted) {
      const pct = Math.round((stats.alive / stats.total) * 100);
      console.log(`  ${name}: ${stats.alive}/${stats.total} survived (${pct}%) | ${stats.wins} wins`);
    }

    expect(true).toBe(true);
  });
});
