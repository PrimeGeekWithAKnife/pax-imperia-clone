/**
 * Psychology System Playtest — Long Conquest (15000 ticks, 8 players)
 *
 * 10 games × 15000 ticks × 8 players, conquest victory only, medium galaxy.
 * Extended duration lets us observe:
 *  - Late-game alliance shifts under sustained pressure
 *  - Personality evolution from accumulated experiences
 *  - Stress/recovery cycles over thousands of ticks
 *  - Whether conquest victory is achievable at this scale
 *  - Which species consistently dominate or are eliminated
 *  - Coalition formation and betrayal dynamics
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
const MAX_TICKS = 15_000;

const COLOURS = ['#4488ff', '#ff4444', '#44ff44', '#ffaa00', '#aa44ff', '#44ffff', '#ff44aa', '#aaffaa'];

const GAME_CONFIGS: { label: string; species: string[]; seed: number }[] = [
  {
    label: 'Classic 8',
    species: ['teranos', 'khazari', 'drakmari', 'sylvani', 'nexari', 'vethara', 'luminari', 'orivani'],
    seed: 51001,
  },
  {
    label: 'Predators vs pacifists',
    species: ['drakmari', 'khazari', 'orivani', 'thyriaq', 'sylvani', 'luminari', 'aethyn', 'vaelori'],
    seed: 52002,
  },
  {
    label: 'Hive minds & machines',
    species: ['nexari', 'zorvathi', 'kaelenth', 'thyriaq', 'teranos', 'ashkari', 'pyrenth', 'vethara'],
    seed: 53003,
  },
  {
    label: 'All the anxiety',
    species: ['vethara', 'orivani', 'ashkari', 'teranos', 'drakmari', 'nexari', 'sylvani', 'khazari'],
    seed: 54004,
  },
  {
    label: 'Silicon vs carbon',
    species: ['khazari', 'pyrenth', 'kaelenth', 'zorvathi', 'teranos', 'vethara', 'sylvani', 'drakmari'],
    seed: 55005,
  },
  {
    label: 'Mystics & brutes',
    species: ['vaelori', 'aethyn', 'luminari', 'orivani', 'drakmari', 'khazari', 'zorvathi', 'thyriaq'],
    seed: 56006,
  },
  {
    label: 'Diplomats under siege',
    species: ['teranos', 'sylvani', 'vethara', 'ashkari', 'luminari', 'drakmari', 'khazari', 'nexari'],
    seed: 57007,
  },
  {
    label: 'Dark Triad showdown',
    species: ['drakmari', 'kaelenth', 'thyriaq', 'nexari', 'orivani', 'khazari', 'teranos', 'pyrenth'],
    seed: 58008,
  },
  {
    label: 'Galactic melting pot',
    species: ['teranos', 'aethyn', 'zorvathi', 'vethara', 'pyrenth', 'orivani', 'luminari', 'kaelenth'],
    seed: 59009,
  },
  {
    label: 'Attachment extremes',
    species: ['sylvani', 'teranos', 'luminari', 'aethyn', 'khazari', 'pyrenth', 'drakmari', 'thyriaq'],
    seed: 50100,
  },
];

interface LongGameResult {
  label: string;
  finalTick: number;
  winner: string | null;
  winnerAttachment: string | null;
  gameFinished: boolean;
  combatEvents: number;
  planetsConquered: number;
  alliancesAtEnd: number;
  empiresEliminated: number;
  /** Timeline snapshots at regular intervals. */
  snapshots: GameSnapshot[];
  speciesEndState: Record<string, SpeciesEndState>;
}

interface GameSnapshot {
  tick: number;
  alive: number;
  empires: {
    name: string;
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
  }[];
  combats: number;
  conquered: number;
}

interface SpeciesEndState {
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
  eliminatedTick: number | null;
}

function runLongConquest(cfg: typeof GAME_CONFIGS[0]): LongGameResult {
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

  let winner: string | null = null;
  let victoryType: string | null = null;
  let gameFinished = false;
  let combatEvents = 0;
  let planetsConquered = 0;
  const snapshots: GameSnapshot[] = [];
  const eliminationTicks: Record<string, number> = {};

  // Snapshot intervals: every 1500 ticks (10 snapshots over 15000)
  const SNAPSHOT_TICKS = new Set([
    999, 1999, 2999, 3999, 4999, 6999, 8999, 10999, 12999, 14999,
  ]);

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

    // Count captures from notifications
    const notifications = ((state as unknown as Record<string, unknown>).notifications ?? []) as Array<Record<string, unknown>>;
    for (const n of notifications) {
      if (n.type === 'planet_captured') planetsConquered++;
    }

    // Track eliminations
    for (const emp of state.gameState.empires) {
      if (!eliminationTicks[emp.id]) {
        const planets = state.gameState.galaxy.systems.flatMap(s => s.planets).filter(p => p.ownerId === emp.id);
        const ships = state.gameState.fleets.filter(f => f.empireId === emp.id).reduce((sum, f) => sum + f.ships.length, 0);
        if (planets.length === 0 && ships === 0) {
          eliminationTicks[emp.id] = t;
        }
      }
    }

    // Take snapshot
    if (SNAPSHOT_TICKS.has(t)) {
      const psychMap = ((state as unknown as Record<string, unknown>).psychStateMap ?? new Map()) as
        Map<string, EmpirePsychologicalState>;
      const empireData = state.gameState.empires.map(emp => {
        const planets = state.gameState.galaxy.systems.flatMap(s => s.planets).filter(p => p.ownerId === emp.id);
        const ships = state.gameState.fleets.filter(f => f.empireId === emp.id).reduce((sum, f) => sum + f.ships.length, 0);
        const diplo = emp.diplomacy ?? [];
        const allies = diplo.filter(r => r.status === 'allied' || r.treaties?.some(tr => (tr as Record<string, unknown>).type === 'alliance')).length;
        const wars = diplo.filter(r => r.status === 'at_war').length;
        const alive = planets.length > 0 || ships > 0;
        const psych = psychMap.get(emp.id);
        return {
          name: emp.species.name,
          attachment: psych?.personality.attachmentStyle ?? '?',
          planets: planets.length,
          ships,
          allies,
          wars,
          mood: psych?.mood.valence ?? 0,
          stress: psych?.stressLevel ?? '?',
          safety: psych?.needs.safety ?? 0,
          belonging: psych?.needs.belonging ?? 0,
          alive,
        };
      });
      snapshots.push({
        tick: t + 1,
        alive: empireData.filter(e => e.alive).length,
        empires: empireData,
        combats: combatEvents,
        conquered: planetsConquered,
      });
    }

    if (gameFinished) break;
  }

  // End state
  const psychMap = ((state as unknown as Record<string, unknown>).psychStateMap ?? new Map()) as
    Map<string, EmpirePsychologicalState>;
  const speciesEndState: Record<string, SpeciesEndState> = {};
  let empiresEliminated = 0;
  let alliancesAtEnd = 0;

  for (const emp of state.gameState.empires) {
    const planets = state.gameState.galaxy.systems.flatMap(s => s.planets).filter(p => p.ownerId === emp.id);
    const ships = state.gameState.fleets.filter(f => f.empireId === emp.id).reduce((sum, f) => sum + f.ships.length, 0);
    const diplo = emp.diplomacy ?? [];
    const allies = diplo.filter(r => r.status === 'allied' || r.treaties?.some(tr => (tr as Record<string, unknown>).type === 'alliance')).length;
    const wars = diplo.filter(r => r.status === 'at_war').length;
    const alive = planets.length > 0;
    if (!alive) empiresEliminated++;
    alliancesAtEnd += allies;
    const psych = psychMap.get(emp.id);
    speciesEndState[emp.species.name] = {
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
      eliminatedTick: eliminationTicks[emp.id] ?? null,
    };
  }
  alliancesAtEnd = Math.round(alliancesAtEnd / 2);

  const winnerSpecies = winner ? state.gameState.empires.find(e => e.id === winner)?.species.name ?? null : null;
  const winnerPsych = winner ? psychMap.get(winner) : null;

  return {
    label: cfg.label,
    finalTick: state.gameState.currentTick,
    winner: winnerSpecies,
    winnerAttachment: winnerPsych?.personality.attachmentStyle ?? null,
    gameFinished,
    combatEvents,
    planetsConquered,
    alliancesAtEnd,
    empiresEliminated,
    snapshots,
    speciesEndState,
  };
}

describe('Long Conquest Playtest: 10 games × 15000 ticks × 8 players', () => {
  const results: LongGameResult[] = [];

  for (let i = 0; i < GAME_CONFIGS.length; i++) {
    const cfg = GAME_CONFIGS[i];
    it(`Game ${i + 1}: ${cfg.label}`, () => {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`=== Game ${i + 1}: ${cfg.label} ===`);
      console.log(`=== Species: ${cfg.species.join(', ')} ===`);
      console.log(`${'='.repeat(70)}`);

      const result = runLongConquest(cfg);
      results.push(result);

      // Print timeline
      for (const snap of result.snapshots) {
        console.log(`\n  t=${snap.tick} (${snap.alive}/8 alive, combats=${snap.combats}, conquered=${snap.conquered}):`);
        for (const emp of snap.empires) {
          const status = emp.alive ? '' : ' [DEAD]';
          console.log(`    ${emp.name} [${emp.attachment}]${status}: ${emp.planets} cols, ${emp.ships} ships, ${emp.allies} allies, ${emp.wars} wars | mood=${emp.mood} stress=${emp.stress} safety=${emp.safety}`);
        }
      }

      console.log(`\n  RESULT: ${result.gameFinished
        ? `${result.winner} [${result.winnerAttachment}] CONQUEST VICTORY at tick ${result.finalTick}`
        : `NO WINNER after ${MAX_TICKS} ticks`}`);
      console.log(`  Combats: ${result.combatEvents} | Conquered: ${result.planetsConquered} | Alliances: ${result.alliancesAtEnd} | Eliminated: ${result.empiresEliminated}/8`);

      // Elimination timeline
      const eliminated = Object.entries(result.speciesEndState)
        .filter(([, s]) => s.eliminatedTick !== null)
        .sort((a, b) => (a[1].eliminatedTick ?? 0) - (b[1].eliminatedTick ?? 0));
      if (eliminated.length > 0) {
        console.log('  Elimination order:');
        for (const [name, s] of eliminated) {
          console.log(`    t=${s.eliminatedTick}: ${name} [${s.attachment}]`);
        }
      }

      expect(result.finalTick).toBeGreaterThan(0);
    }, 600_000); // 10 min timeout
  }

  it('Summary', () => {
    console.log(`\n${'='.repeat(70)}`);
    console.log('=== LONG CONQUEST PLAYTEST SUMMARY (15000 ticks) ===');
    console.log(`${'='.repeat(70)}`);

    const victories = results.filter(r => r.gameFinished);
    console.log(`\nConquest victories: ${victories.length} / ${results.length}`);
    if (victories.length > 0) {
      console.log('Winners:');
      for (const v of victories) {
        console.log(`  ${v.label}: ${v.winner} [${v.winnerAttachment}] at t=${v.finalTick}`);
      }
    }

    console.log(`\nTotals across ${results.length} games:`);
    console.log(`  Combats: ${results.reduce((s, r) => s + r.combatEvents, 0)}`);
    console.log(`  Planets conquered: ${results.reduce((s, r) => s + r.planetsConquered, 0)}`);
    console.log(`  Alliances at end: ${results.reduce((s, r) => s + r.alliancesAtEnd, 0)}`);
    console.log(`  Empires eliminated: ${results.reduce((s, r) => s + r.empiresEliminated, 0)} / ${results.length * 8}`);

    // Winner styles
    const winnerStyles: Record<string, number> = {};
    for (const r of victories) {
      const style = r.winnerAttachment ?? 'none';
      winnerStyles[style] = (winnerStyles[style] ?? 0) + 1;
    }
    if (Object.keys(winnerStyles).length > 0) {
      console.log(`\nWinner attachment styles: ${JSON.stringify(winnerStyles)}`);
    }

    // Species survival + win rates
    const stats: Record<string, { appearances: number; survived: number; wins: number; avgElimTick: number; elimCount: number }> = {};
    for (const r of results) {
      for (const [name, s] of Object.entries(r.speciesEndState)) {
        if (!stats[name]) stats[name] = { appearances: 0, survived: 0, wins: 0, avgElimTick: 0, elimCount: 0 };
        stats[name].appearances++;
        if (s.alive) stats[name].survived++;
        if (r.winner === name) stats[name].wins++;
        if (s.eliminatedTick !== null) {
          stats[name].avgElimTick += s.eliminatedTick;
          stats[name].elimCount++;
        }
      }
    }

    console.log('\nSpecies performance:');
    const sorted = Object.entries(stats).sort((a, b) => {
      const aRate = a[1].survived / a[1].appearances;
      const bRate = b[1].survived / b[1].appearances;
      return bRate - aRate;
    });
    for (const [name, s] of sorted) {
      const survPct = Math.round((s.survived / s.appearances) * 100);
      const avgElim = s.elimCount > 0 ? Math.round(s.avgElimTick / s.elimCount) : null;
      console.log(`  ${name}: ${s.survived}/${s.appearances} survived (${survPct}%) | ${s.wins} wins${avgElim !== null ? ` | avg elimination: t=${avgElim}` : ''}`);
    }

    // Per-game one-liner
    console.log('\nPer-game:');
    for (const r of results) {
      const status = r.gameFinished
        ? `${r.winner} [${r.winnerAttachment}] wins t=${r.finalTick}`
        : `no winner`;
      console.log(`  ${r.label}: ${status} | combats=${r.combatEvents} conquered=${r.planetsConquered} eliminated=${r.empiresEliminated}`);
    }

    expect(true).toBe(true);
  });
});
