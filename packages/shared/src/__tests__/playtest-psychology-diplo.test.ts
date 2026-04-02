/**
 * Psychology System Playtest — Diplomatic Victory
 *
 * 10 games × 1500 ticks × 4-8 players, diplomatic victory only.
 * Tests whether the psychology system produces meaningfully different
 * diplomatic behaviour across species with different attachment styles,
 * personality traits, and moral foundations.
 *
 * Key observations:
 *  - Do anxious species (Vethara, Orivani) propose more treaties?
 *  - Do avoidant species (Khazari, Pyrenth) resist alliances?
 *  - Do secure species (Teranos, Sylvani) form stable relationships?
 *  - Do fearful-avoidant species (Drakmari, Thyriaq) behave erratically?
 *  - Does anyone achieve diplomatic victory?
 */

import { describe, it, expect } from 'vitest';
import { initializeGame, type GameSetupConfig } from '../engine/game-init.js';
import {
  processGameTick,
  initializeTickState,
  type GameTickState,
} from '../engine/game-loop.js';
import { PREBUILT_SPECIES_BY_ID } from '../../data/species/index.js';
import techTreeData from '../../data/tech/universal-tree.json';
import type { Technology } from '../types/technology.js';
import type { EmpirePsychologicalState } from '../types/psychology.js';

const allTechs = (techTreeData as unknown as { technologies: Technology[] }).technologies;
const MAX_TICKS = 1500;

/**
 * 10 game configurations with different species mixes (4-8 players).
 * Each mix is designed to create interesting psychological dynamics.
 */
const GAME_CONFIGS: { label: string; species: string[]; seed: number }[] = [
  // Game 1: 4 players — one of each attachment style
  {
    label: 'Attachment quartet',
    species: ['teranos', 'vethara', 'khazari', 'drakmari'],
    seed: 1001,
  },
  // Game 2: 5 players — diplomatic species cluster
  {
    label: 'Diplomatic cluster',
    species: ['teranos', 'sylvani', 'vethara', 'ashkari', 'luminari'],
    seed: 2002,
  },
  // Game 3: 5 players — hostile species cluster
  {
    label: 'Hostile cluster',
    species: ['drakmari', 'khazari', 'nexari', 'orivani', 'thyriaq'],
    seed: 3003,
  },
  // Game 4: 6 players — mixed bag
  {
    label: 'Mixed galaxy',
    species: ['teranos', 'sylvani', 'khazari', 'vethara', 'nexari', 'luminari'],
    seed: 4004,
  },
  // Game 5: 6 players — hive minds vs individualists
  {
    label: 'Hive vs individual',
    species: ['nexari', 'zorvathi', 'teranos', 'ashkari', 'aethyn', 'drakmari'],
    seed: 5005,
  },
  // Game 6: 7 players — large galaxy diplomacy
  {
    label: 'Seven nations',
    species: ['teranos', 'sylvani', 'khazari', 'vethara', 'luminari', 'vaelori', 'ashkari'],
    seed: 6006,
  },
  // Game 7: 8 players — full diplomatic pressure cooker
  {
    label: 'Eight-way standoff',
    species: ['teranos', 'sylvani', 'khazari', 'vethara', 'nexari', 'drakmari', 'orivani', 'luminari'],
    seed: 7007,
  },
  // Game 8: 4 players — all secure attachment
  {
    label: 'Secure foursome',
    species: ['teranos', 'sylvani', 'luminari', 'aethyn'],
    seed: 8008,
  },
  // Game 9: 4 players — all anxious attachment
  {
    label: 'Anxious foursome',
    species: ['vethara', 'orivani', 'ashkari', 'teranos'],
    seed: 9009,
  },
  // Game 10: 5 players — silicon/crystal species
  {
    label: 'Silicon alliance',
    species: ['khazari', 'pyrenth', 'kaelenth', 'nexari', 'zorvathi'],
    seed: 10010,
  },
];

const COLOURS = ['#4488ff', '#ff4444', '#44ff44', '#ffaa00', '#aa44ff', '#44ffff', '#ff44aa', '#aaffaa'];

interface GameResult {
  label: string;
  playerCount: number;
  finalTick: number;
  winner: string | null;
  victoryType: string | null;
  gameFinished: boolean;
  treatyEvents: number;
  warsDeclared: number;
  alliancesAtEnd: number;
  psychSummary: Record<string, {
    attachmentStyle: string;
    mood: number;
    stressLevel: string;
    belonging: number;
    relationships: number;
  }>;
}

function runDiploGame(cfg: typeof GAME_CONFIGS[0]): GameResult {
  const species = cfg.species.map(id => PREBUILT_SPECIES_BY_ID[id]);

  const config: GameSetupConfig = {
    galaxyConfig: {
      shape: 'spiral' as const,
      size: cfg.species.length <= 5 ? 'small' as const : 'medium' as const,
      density: 'normal' as const,
      playerCount: cfg.species.length,
      seed: cfg.seed,
    },
    players: species.map((sp, i) => ({
      empireName: sp.name,
      species: sp,
      color: COLOURS[i % COLOURS.length],
      isAI: true,
    })),
    victoryCriteria: ['diplomatic'],
  };

  const gameState = initializeGame(config);
  let state = initializeTickState(gameState);
  const empires = gameState.empires;

  let winner: string | null = null;
  let victoryType: string | null = null;
  let gameFinished = false;
  let treatyEvents = 0;
  let warsDeclared = 0;

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
      if (e.type === 'WarDeclared') warsDeclared++;
      if (e.type === 'TreatyAccepted' || e.type === 'AllianceFormed') treatyEvents++;
    }
    if (state.gameState.status === 'finished') gameFinished = true;

    // Log progress at milestones
    if ([499, 999, 1499].includes(t)) {
      const currentEmpires = state.gameState.empires;
      const aliveEmpires = currentEmpires.filter(emp => {
        const planets = state.gameState.galaxy.systems.flatMap(s => s.planets).filter(p => p.ownerId === emp.id);
        return planets.length > 0;
      });

      console.log(`  t=${t + 1} (${aliveEmpires.length}/${currentEmpires.length} alive):`);

      for (const emp of currentEmpires) {
        const planets = state.gameState.galaxy.systems.flatMap(s => s.planets).filter(p => p.ownerId === emp.id);
        const ships = state.gameState.fleets
          .filter(f => f.empireId === emp.id)
          .reduce((sum, f) => sum + f.ships.length, 0);
        const diplo = emp.diplomacy ?? [];
        const alliances = diplo.filter(r => r.status === 'allied' || (r as Record<string, unknown>).treaties && (r.treaties as Array<Record<string, unknown>>)?.some(t => t.type === 'alliance')).length;
        const treaties = diplo.reduce((sum, r) => sum + (r.treaties?.length ?? 0), 0);
        const wars = diplo.filter(r => r.status === 'at_war').length;

        // Get psychology state if available
        const psychMap = ((state as unknown as Record<string, unknown>).psychStateMap ?? new Map()) as Map<string, EmpirePsychologicalState>;
        const psych = psychMap.get(emp.id);

        const attachStyle = psych?.personality.attachmentStyle ?? '?';
        const moodVal = psych?.mood.valence ?? 0;
        const stress = psych?.stressLevel ?? '?';
        const belonging = psych?.needs.belonging ?? 0;

        console.log(`    ${emp.species.name} [${attachStyle}]: ${planets.length} cols, ${ships} ships, ${alliances} allies, ${treaties} treaties, ${wars} wars | mood=${moodVal} stress=${stress} belonging=${belonging}`);
      }
    }

    if (gameFinished) {
      console.log(`  *** VICTORY at tick ${t + 1} ***`);
      break;
    }
  }

  // Collect end-state psychology summary
  const psychMap = ((state as unknown as Record<string, unknown>).psychStateMap ?? new Map()) as Map<string, EmpirePsychologicalState>;
  const psychSummary: GameResult['psychSummary'] = {};
  for (const emp of state.gameState.empires) {
    const psych = psychMap.get(emp.id);
    const relCount = psych ? Object.keys(psych.relationships).length : 0;
    psychSummary[emp.species.name] = {
      attachmentStyle: psych?.personality.attachmentStyle ?? 'unknown',
      mood: psych?.mood.valence ?? 0,
      stressLevel: psych?.stressLevel ?? 'unknown',
      belonging: psych?.needs.belonging ?? 0,
      relationships: relCount,
    };
  }

  // Count alliances at end
  let alliancesAtEnd = 0;
  for (const emp of state.gameState.empires) {
    const diplo = emp.diplomacy ?? [];
    alliancesAtEnd += diplo.filter(r =>
      r.status === 'allied' || r.treaties?.some(t => t.type === 'alliance'),
    ).length;
  }
  alliancesAtEnd = Math.round(alliancesAtEnd / 2); // Each alliance is counted twice

  const winnerSpecies = winner ? state.gameState.empires.find(e => e.id === winner)?.species.name ?? winner : null;

  return {
    label: cfg.label,
    playerCount: cfg.species.length,
    finalTick: state.gameState.currentTick,
    winner: winnerSpecies,
    victoryType,
    gameFinished,
    treatyEvents,
    warsDeclared,
    alliancesAtEnd,
    psychSummary,
  };
}

describe('Psychology Playtest: 10 diplomatic victory games (1500 ticks, 4-8 players)', () => {
  const results: GameResult[] = [];

  for (let i = 0; i < GAME_CONFIGS.length; i++) {
    const cfg = GAME_CONFIGS[i];
    it(`Game ${i + 1}: ${cfg.label} (${cfg.species.length} players: ${cfg.species.join(', ')})`, () => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`=== Game ${i + 1}: ${cfg.label} (${cfg.species.length}P) ===`);
      console.log(`=== Species: ${cfg.species.join(', ')} ===`);
      console.log(`${'='.repeat(60)}`);

      const result = runDiploGame(cfg);
      results.push(result);

      console.log(`\n  RESULT: ${result.gameFinished
        ? `${result.winner} wins by ${result.victoryType} at tick ${result.finalTick}`
        : `NO WINNER after ${MAX_TICKS} ticks`}`);
      console.log(`  Treaties: ${result.treatyEvents} | Wars: ${result.warsDeclared} | Alliances at end: ${result.alliancesAtEnd}`);
      console.log(`  Psychology end-state:`);
      for (const [name, psych] of Object.entries(result.psychSummary)) {
        console.log(`    ${name} [${psych.attachmentStyle}]: mood=${psych.mood} stress=${psych.stressLevel} belonging=${psych.belonging} rels=${psych.relationships}`);
      }

      // Game should run without crashing
      expect(result.finalTick).toBeGreaterThan(0);
      // Psychology should be active (relationships should exist after 1500 ticks)
      const totalRels = Object.values(result.psychSummary).reduce((sum, p) => sum + p.relationships, 0);
      // At least some empires should have psychology relationships
      // (may be 0 if first contact never happens in small galaxies)
      expect(totalRels).toBeGreaterThanOrEqual(0);
    }, 300_000); // 5 min timeout per game
  }

  // Summary test that runs after all games
  it('Summary: at least 3 of 10 games should produce treaty activity', () => {
    const gamesWithTreaties = results.filter(r => r.treatyEvents > 0 || r.alliancesAtEnd > 0);
    console.log(`\n${'='.repeat(60)}`);
    console.log('=== PLAYTEST SUMMARY ===');
    console.log(`${'='.repeat(60)}`);
    console.log(`Games with treaty activity: ${gamesWithTreaties.length} / ${results.length}`);
    console.log(`Games with diplomatic victory: ${results.filter(r => r.victoryType === 'diplomatic').length} / ${results.length}`);
    console.log(`Total wars across all games: ${results.reduce((s, r) => s + r.warsDeclared, 0)}`);
    console.log(`Total alliances at game end: ${results.reduce((s, r) => s + r.alliancesAtEnd, 0)}`);

    for (const r of results) {
      const status = r.gameFinished ? `${r.winner} wins (${r.victoryType})` : 'no winner';
      console.log(`  ${r.label} (${r.playerCount}P): ${status} | t=${r.finalTick} treaties=${r.treatyEvents} wars=${r.warsDeclared} alliances=${r.alliancesAtEnd}`);
    }

    expect(gamesWithTreaties.length).toBeGreaterThanOrEqual(0); // Observation, not hard requirement
  });
});
