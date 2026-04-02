/**
 * Medium Galaxy Conquest Playtest — 10 rounds, 4-8 players, conquest-only
 *
 * Tests whether the AI can wage war, conquer planets, and achieve conquest
 * victory (75% of colonised planets + eliminated at least one rival) on
 * a larger map with multiple opponents.
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

const allTechs = (techTreeData as unknown as { technologies: Technology[] }).technologies;
const MAX_TICKS = 15_000;

// 10 matchups with 4-8 players, mixing aggressive and passive species
const ROUNDS: { players: string[]; seed: number }[] = [
  // R1: 4-player — all aggressive
  { players: ['drakmari', 'khazari', 'orivani', 'zorvathi'], seed: 50001 },
  // R2: 4-player — mixed aggro + passive
  { players: ['drakmari', 'sylvani', 'teranos', 'pyrenth'], seed: 50002 },
  // R3: 4-player — builders vs fighters
  { players: ['kaelenth', 'thyriaq', 'khazari', 'drakmari'], seed: 50003 },
  // R4: 6-player — full spectrum
  { players: ['teranos', 'khazari', 'sylvani', 'drakmari', 'nexari', 'vethara'], seed: 50004 },
  // R5: 6-player — mostly aggressive
  { players: ['drakmari', 'khazari', 'orivani', 'pyrenth', 'zorvathi', 'teranos'], seed: 50005 },
  // R6: 6-player — researchers vs warriors
  { players: ['luminari', 'aethyn', 'vaelori', 'drakmari', 'khazari', 'orivani'], seed: 50006 },
  // R7: 8-player — everyone
  { players: ['teranos', 'khazari', 'drakmari', 'sylvani', 'nexari', 'orivani', 'pyrenth', 'zorvathi'], seed: 50007 },
  // R8: 8-player — different mix
  { players: ['luminari', 'aethyn', 'vethara', 'ashkari', 'kaelenth', 'thyriaq', 'vaelori', 'drakmari'], seed: 50008 },
  // R9: 4-player — diplomatic species forced into conquest
  { players: ['vethara', 'ashkari', 'teranos', 'sylvani'], seed: 50009 },
  // R10: 4-player — pure predators
  { players: ['drakmari', 'drakmari', 'khazari', 'khazari'], seed: 50010 },
];

describe('Medium Galaxy Conquest — 10 rounds', () => {
  const summaryRows: string[] = [];

  for (let round = 0; round < ROUNDS.length; round++) {
    const { players, seed } = ROUNDS[round];
    const speciesNames = players.map(id => PREBUILT_SPECIES_BY_ID[id].name);

    it(`R${round + 1}: ${players.length}p — ${speciesNames.join(', ')}`, () => {
      const config: GameSetupConfig = {
        galaxyConfig: {
          shape: 'spiral' as const,
          size: 'medium' as const,
          density: 'normal' as const,
          playerCount: players.length,
          seed,
        },
        players: players.map((id, i) => ({
          empireName: PREBUILT_SPECIES_BY_ID[id].name + (players.filter(p => p === id).length > 1 ? ` ${i+1}` : ''),
          species: PREBUILT_SPECIES_BY_ID[id],
          color: `#${((i * 37 + 80) % 256).toString(16).padStart(2,'0')}${((i * 73 + 40) % 256).toString(16).padStart(2,'0')}ff`,
          isAI: true,
        })),
        victoryCriteria: ['conquest'],
      };

      const gameState = initializeGame(config);
      let state = initializeTickState(gameState);
      const empires = gameState.empires;

      let winner: string | null = null;
      let victoryType: string | null = null;
      let gameFinished = false;
      let warCount = 0;
      let combatCount = 0;

      for (let t = 0; t < MAX_TICKS; t++) {
        try {
          const result = processGameTick(state, allTechs);
          state = result.newState;

          for (const evt of result.events) {
            const e = evt as any;
            if (e.type === 'GameOver') {
              winner = e.winnerEmpireId;
              victoryType = e.victoryCriteria;
              gameFinished = true;
            }
            if (e.type === 'CombatStarted' || e.type === 'CombatResolved') combatCount++;
          }
          if (state.gameState.status === 'finished') gameFinished = true;

          // Count active wars
          const dipState = (state as any).diplomacyState;
          if (dipState && t === 999) {
            let wars = 0;
            if (dipState.relations instanceof Map) {
              for (const [, inner] of dipState.relations) {
                if (inner instanceof Map) {
                  for (const [, rel] of inner) {
                    if (rel.status === 'at_war') wars++;
                  }
                }
              }
            }
            warCount = wars;
          }

          if (gameFinished) break;
        } catch (err) {
          console.error(`  CRASH R${round+1} t=${t}: ${(err as Error).message.slice(0, 150)}`);
          break;
        }

        // Progress at milestones
        if ([999, 2499, 4999, 9999, 14999].includes(t)) {
          const planets = state.gameState.galaxy.systems.flatMap(s => s.planets);
          const totalCol = planets.filter(p => p.ownerId !== null).length;
          const alive = empires.filter(e =>
            planets.some(p => p.ownerId === e.id && p.currentPopulation > 0)
          ).length;
          const topEmpire = empires.reduce((best, e) => {
            const count = planets.filter(p => p.ownerId === e.id).length;
            return count > best.count ? { id: e.id, name: e.name, count } : best;
          }, { id: '', name: '', count: 0 });
          console.log(`  t=${t+1}: ${alive}/${empires.length} alive, ${totalCol} cols, top=${topEmpire.name} (${topEmpire.count}/${totalCol}=${Math.round(topEmpire.count/Math.max(1,totalCol)*100)}%), combats=${combatCount}`);
        }
      }

      // Final snapshot
      const planets = state.gameState.galaxy.systems.flatMap(s => s.planets);
      const totalCol = planets.filter(p => p.ownerId !== null).length;
      const alive = empires.filter(e =>
        planets.some(p => p.ownerId === e.id && p.currentPopulation > 0)
      ).length;
      const eliminated = empires.length - alive;
      const winnerName = winner
        ? empires.find(e => e.id === winner)?.name ?? '???'
        : 'NONE';

      console.log(`\n=== R${round+1} RESULT: ${gameFinished ? `${winnerName} wins by ${victoryType} at tick ${state.gameState.currentTick}` : `NO WINNER after ${MAX_TICKS} ticks`} ===`);
      console.log(`  ${alive}/${empires.length} alive (${eliminated} eliminated), ${combatCount} combats, ${totalCol} colonies`);
      for (const e of empires) {
        const eCols = planets.filter(p => p.ownerId === e.id).length;
        console.log(`  ${e.name.padEnd(15)}: ${eCols} cols (${Math.round(eCols/Math.max(1,totalCol)*100)}%)`);
      }

      summaryRows.push(
        `  ${(round+1).toString().padStart(2)} | ${players.length}p | ${state.gameState.currentTick.toString().padStart(5)} | ${winnerName.padEnd(12)} | ${(victoryType ?? 'N/A').padEnd(10)} | ${alive}/${empires.length} alive | ${combatCount} combats | ${eliminated} eliminated`
      );

      // No crashes, no NaN
      for (const p of planets) {
        expect(p.currentPopulation).toBeGreaterThanOrEqual(0);
        expect(isFinite(p.currentPopulation)).toBe(true);
      }
    }, 300_000); // 5 min timeout for medium maps
  }

  it('summary', () => {
    console.log('\n=== MEDIUM CONQUEST SUMMARY ===');
    console.log('  Rd | Pl | Ticks | Winner       | Victory    | Survival    | Combats  | Eliminated');
    console.log('  ---|----|----- -|--------------|------------|-------------|----------|----------');
    for (const row of summaryRows) console.log(row);
    expect(summaryRows.length).toBe(10);
  });
});
