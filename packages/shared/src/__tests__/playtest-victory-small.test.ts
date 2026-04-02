/**
 * Victory Condition Playtest — Small Galaxies, 10 rounds
 *
 * Runs 10 games on small galaxies (2 players each) to completion or 10,000
 * ticks max. More systems than tiny = more room for expansion, colonisation,
 * conquest, and diplomatic play.
 */

import { describe, it, expect } from 'vitest';
import { initializeGame, type GameSetupConfig } from '../engine/game-init.js';
import {
  processGameTick,
  initializeTickState,
  type GameTickState,
} from '../engine/game-loop.js';
import { getAbilityFoodModifier } from '../engine/economy.js';
import { PREBUILT_SPECIES, PREBUILT_SPECIES_BY_ID } from '../../data/species/index.js';
import techTreeData from '../../data/tech/universal-tree.json';
import type { Technology } from '../types/technology.js';

const allTechs = (techTreeData as unknown as { technologies: Technology[] }).technologies;
const MAX_TICKS = 10_000;

const MATCHUPS: [string, string][] = [
  ['teranos', 'khazari'],
  ['sylvani', 'drakmari'],
  ['nexari', 'orivani'],
  ['kaelenth', 'zorvathi'],
  ['luminari', 'pyrenth'],
  ['aethyn', 'vethara'],
  ['ashkari', 'thyriaq'],
  ['teranos', 'sylvani'],
  ['drakmari', 'zorvathi'],
  ['khazari', 'luminari'],
];

describe('Victory Playtest — 10 small galaxy rounds', () => {
  const summaryRows: string[] = [];

  for (let round = 0; round < MATCHUPS.length; round++) {
    const [id1, id2] = MATCHUPS[round];
    const sp1 = PREBUILT_SPECIES_BY_ID[id1];
    const sp2 = PREBUILT_SPECIES_BY_ID[id2];

    it(`Round ${round + 1}: ${sp1.name} vs ${sp2.name}`, () => {
      const config: GameSetupConfig = {
        galaxyConfig: {
          shape: 'spiral' as const,
          size: 'small' as const,
          density: 'normal' as const,
          playerCount: 2,
          seed: 80000 + round,
        },
        players: [
          { empireName: sp1.name, species: sp1, color: '#4488ff', isAI: true },
          { empireName: sp2.name, species: sp2, color: '#ff4444', isAI: true },
        ],
      };

      const gameState = initializeGame(config);
      let state = initializeTickState(gameState);
      const e1 = gameState.empires[0];
      const e2 = gameState.empires[1];
      const mod1 = getAbilityFoodModifier(sp1.specialAbilities) * (sp1.traits.reproduction / 5);
      const mod2 = getAbilityFoodModifier(sp2.specialAbilities) * (sp2.traits.reproduction / 5);

      let winner: string | null = null;
      let victoryType: string | null = null;
      let gameFinished = false;
      let crashDetected = false;
      let nanDetected = false;
      let negPopDetected = false;
      let p1StarvTicks = 0;
      let p2StarvTicks = 0;

      for (let t = 0; t < MAX_TICKS; t++) {
        try {
          const result = processGameTick(state, allTechs);
          state = result.newState;

          for (const evt of result.events) {
            if ((evt as any).type === 'GameOver') {
              winner = (evt as any).winnerEmpireId;
              victoryType = (evt as any).victoryCriteria;
              gameFinished = true;
            }
          }
          if (state.gameState.status === 'finished') gameFinished = true;

          // NaN / negative pop check
          for (const p of state.gameState.galaxy.systems.flatMap(s => s.planets)) {
            if (isNaN(p.currentPopulation) || !isFinite(p.currentPopulation)) nanDetected = true;
            if (p.currentPopulation < 0) negPopDetected = true;
          }

          // Starvation tracking
          const resMap = state.empireResourcesMap;
          if (resMap instanceof Map) {
            const r1 = resMap.get(e1.id);
            const r2 = resMap.get(e2.id);
            if (r1 && r1.organics <= 0 && mod1 > 0) p1StarvTicks++;
            if (r2 && r2.organics <= 0 && mod2 > 0) p2StarvTicks++;
            if (r1 && (isNaN(r1.organics) || isNaN(r1.credits))) nanDetected = true;
            if (r2 && (isNaN(r2.organics) || isNaN(r2.credits))) nanDetected = true;
          }

          if (gameFinished) break;
        } catch (err) {
          console.error(`  CRASH at tick ${t}: ${(err as Error).message.slice(0, 200)}`);
          crashDetected = true;
          break;
        }
      }

      // Final stats
      const planets = state.gameState.galaxy.systems.flatMap(s => s.planets);
      const p1P = planets.filter(p => p.ownerId === e1.id);
      const p2P = planets.filter(p => p.ownerId === e2.id);
      const p1Pop = p1P.reduce((s, p) => s + p.currentPopulation, 0);
      const p2Pop = p2P.reduce((s, p) => s + p.currentPopulation, 0);
      const p1Food = p1P.flatMap(p => p.buildings).filter(b =>
        ['hydroponics_bay', 'concentrated_farming', 'greenhouse_farming'].includes(b.type)).length;
      const p2Food = p2P.flatMap(p => p.buildings).filter(b =>
        ['hydroponics_bay', 'concentrated_farming', 'greenhouse_farming'].includes(b.type)).length;

      const winnerName = winner === e1.id ? sp1.name : winner === e2.id ? sp2.name : 'NONE';

      console.log(`\n=== Round ${round + 1}: ${sp1.name} vs ${sp2.name} ===`);
      console.log(`  Result: ${gameFinished ? `${winnerName} wins by ${victoryType} at tick ${state.gameState.currentTick}` : `NO WINNER after ${MAX_TICKS} ticks`}`);
      console.log(`  ${sp1.name}: pop=${(p1Pop/1e6).toFixed(0)}M cols=${p1P.length} food=${p1Food} starv=${p1StarvTicks}`);
      console.log(`  ${sp2.name}: pop=${(p2Pop/1e6).toFixed(0)}M cols=${p2P.length} food=${p2Food} starv=${p2StarvTicks}`);

      summaryRows.push(
        `  ${(round+1).toString().padStart(2)} | ${sp1.name.padEnd(11)} | ${sp2.name.padEnd(11)} | ${state.gameState.currentTick.toString().padStart(5)} | ${winnerName.padEnd(11)} | ${(victoryType ?? 'N/A').padEnd(11)} | ${p1P.length}/${p2P.length} cols | ${p1StarvTicks}/${p2StarvTicks} starv`
      );

      expect(crashDetected).toBe(false);
      expect(nanDetected).toBe(false);
      expect(negPopDetected).toBe(false);
    }, 120_000);
  }

  it('summary', () => {
    console.log('\n=== SMALL GALAXY SUMMARY ===');
    console.log('  Rd | Player 1    | Player 2    | Ticks | Winner      | Victory     | Colonies  | Starvation');
    console.log('  ---|-------------|-------------|-------|-------------|-------------|-----------|----------');
    for (const row of summaryRows) console.log(row);
    expect(summaryRows.length).toBe(10);
  });
});
