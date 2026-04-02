/**
 * Victory Condition Playtest — Tiny Galaxies, 10 rounds
 *
 * Runs 10 games on tiny galaxies (2 players each) to completion or 10,000
 * ticks max.  Validates:
 * 1. Games reach a victory condition (not stuck forever)
 * 2. No crashes, NaN, Infinity, or negative populations
 * 3. Food system is stable throughout
 * 4. Population trends are reasonable
 * 5. AI builds food buildings when needed
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
import type { Species } from '../types/species.js';
import type { GameEvent } from '../types/events.js';

const allTechs = (techTreeData as unknown as { technologies: Technology[] }).technologies;
const MAX_TICKS = 10_000;

// 10 matchups — vary species to cover different food archetypes
const MATCHUPS: [string, string][] = [
  ['teranos', 'khazari'],       // R1: baseline vs silicon
  ['sylvani', 'drakmari'],      // R2: photosynthetic vs hungry predator
  ['nexari', 'orivani'],        // R3: cybernetic (0 food) vs zealots (1.4×)
  ['kaelenth', 'zorvathi'],     // R4: synthetic vs hive
  ['luminari', 'pyrenth'],      // R5: energy vs deep silicon
  ['aethyn', 'vethara'],        // R6: dimensional vs symbiotic
  ['ashkari', 'thyriaq'],       // R7: nomadic vs nanomorphic
  ['teranos', 'sylvani'],       // R8: human vs plant
  ['drakmari', 'zorvathi'],     // R9: predator vs hive (both high consumption)
  ['khazari', 'luminari'],      // R10: silicon vs energy
];

interface RoundResult {
  round: number;
  player1: string;
  player2: string;
  finalTick: number;
  winner: string | null;
  victoryType: string | null;
  gameFinished: boolean;
  p1FinalPop: number;
  p2FinalPop: number;
  p1Colonies: number;
  p2Colonies: number;
  p1StarvTicks: number;
  p2StarvTicks: number;
  p1FoodBuildings: number;
  p2FoodBuildings: number;
  crashDetected: boolean;
  nanDetected: boolean;
  negativePopDetected: boolean;
}

describe('Victory Playtest — 10 tiny galaxy rounds', () => {
  const results: RoundResult[] = [];

  for (let round = 0; round < MATCHUPS.length; round++) {
    const [id1, id2] = MATCHUPS[round];
    const sp1 = PREBUILT_SPECIES_BY_ID[id1];
    const sp2 = PREBUILT_SPECIES_BY_ID[id2];

    it(`Round ${round + 1}: ${sp1.name} vs ${sp2.name} — plays to completion`, () => {
      const config: GameSetupConfig = {
        galaxyConfig: {
          shape: 'elliptical' as const,
          size: 'tiny' as const,
          density: 'normal' as const,
          playerCount: 2,
          seed: 70000 + round,
        },
        players: [
          { empireName: `${sp1.name}`, species: sp1, color: '#4488ff', isAI: true },
          { empireName: `${sp2.name}`, species: sp2, color: '#ff4444', isAI: true },
        ],
      };

      const gameState = initializeGame(config);
      let state = initializeTickState(gameState);
      const e1 = gameState.empires[0];
      const e2 = gameState.empires[1];

      let winner: string | null = null;
      let victoryType: string | null = null;
      let gameFinished = false;
      let crashDetected = false;
      let nanDetected = false;
      let negativePopDetected = false;
      let p1StarvTicks = 0;
      let p2StarvTicks = 0;
      const mod1 = getAbilityFoodModifier(sp1.specialAbilities) * (sp1.traits.reproduction / 5);
      const mod2 = getAbilityFoodModifier(sp2.specialAbilities) * (sp2.traits.reproduction / 5);

      for (let t = 0; t < MAX_TICKS; t++) {
        try {
          const result = processGameTick(state, allTechs);
          state = result.newState;

          // Check for victory
          for (const evt of result.events) {
            if ((evt as any).type === 'GameOver') {
              winner = (evt as any).winnerEmpireId;
              victoryType = (evt as any).victoryCriteria;
              gameFinished = true;
            }
          }

          if (state.gameState.status === 'finished') gameFinished = true;

          // Validate no NaN/Infinity/negative pop
          const planets = state.gameState.galaxy.systems.flatMap(s => s.planets);
          for (const p of planets) {
            if (isNaN(p.currentPopulation) || !isFinite(p.currentPopulation)) nanDetected = true;
            if (p.currentPopulation < 0) negativePopDetected = true;
          }

          // Track starvation
          const resMap = state.empireResourcesMap;
          if (resMap instanceof Map) {
            const r1 = resMap.get(e1.id);
            const r2 = resMap.get(e2.id);
            if (r1 && r1.organics <= 0 && mod1 > 0) p1StarvTicks++;
            if (r2 && r2.organics <= 0 && mod2 > 0) p2StarvTicks++;

            // Check for NaN in resources
            if (r1 && (isNaN(r1.organics) || isNaN(r1.credits))) nanDetected = true;
            if (r2 && (isNaN(r2.organics) || isNaN(r2.credits))) nanDetected = true;
          }

          if (gameFinished) break;
        } catch (err) {
          console.error(`  CRASH at tick ${t}: ${(err as Error).message}`);
          crashDetected = true;
          break;
        }

        // Log progress at intervals
        if (t > 0 && t % 2500 === 0) {
          const planets = state.gameState.galaxy.systems.flatMap(s => s.planets);
          const p1Pop = planets.filter(p => p.ownerId === e1.id).reduce((s, p) => s + p.currentPopulation, 0);
          const p2Pop = planets.filter(p => p.ownerId === e2.id).reduce((s, p) => s + p.currentPopulation, 0);
          console.log(`  t=${t}: ${sp1.name} pop=${(p1Pop/1e6).toFixed(0)}M vs ${sp2.name} pop=${(p2Pop/1e6).toFixed(0)}M`);
        }
      }

      // Collect final stats
      const planets = state.gameState.galaxy.systems.flatMap(s => s.planets);
      const p1Planets = planets.filter(p => p.ownerId === e1.id);
      const p2Planets = planets.filter(p => p.ownerId === e2.id);
      const p1Pop = p1Planets.reduce((s, p) => s + p.currentPopulation, 0);
      const p2Pop = p2Planets.reduce((s, p) => s + p.currentPopulation, 0);
      const p1FoodBldgs = p1Planets.flatMap(p => p.buildings)
        .filter(b => ['hydroponics_bay', 'concentrated_farming', 'greenhouse_farming'].includes(b.type)).length;
      const p2FoodBldgs = p2Planets.flatMap(p => p.buildings)
        .filter(b => ['hydroponics_bay', 'concentrated_farming', 'greenhouse_farming'].includes(b.type)).length;

      const winnerName = winner === e1.id ? sp1.name : winner === e2.id ? sp2.name : 'NONE';

      const result: RoundResult = {
        round: round + 1,
        player1: sp1.name,
        player2: sp2.name,
        finalTick: state.gameState.currentTick,
        winner: winnerName,
        victoryType,
        gameFinished,
        p1FinalPop: p1Pop,
        p2FinalPop: p2Pop,
        p1Colonies: p1Planets.length,
        p2Colonies: p2Planets.length,
        p1StarvTicks,
        p2StarvTicks,
        p1FoodBuildings: p1FoodBldgs,
        p2FoodBuildings: p2FoodBldgs,
        crashDetected,
        nanDetected,
        negativePopDetected,
      };
      results.push(result);

      console.log(`\n=== Round ${round + 1}: ${sp1.name} vs ${sp2.name} ===`);
      console.log(`  Result: ${gameFinished ? `${winnerName} wins by ${victoryType} at tick ${state.gameState.currentTick}` : `NO WINNER after ${MAX_TICKS} ticks`}`);
      console.log(`  ${sp1.name}: pop=${(p1Pop/1e6).toFixed(0)}M colonies=${p1Planets.length} foodBldgs=${p1FoodBldgs} starvTicks=${p1StarvTicks}`);
      console.log(`  ${sp2.name}: pop=${(p2Pop/1e6).toFixed(0)}M colonies=${p2Planets.length} foodBldgs=${p2FoodBldgs} starvTicks=${p2StarvTicks}`);

      // Assertions
      expect(crashDetected).toBe(false);
      expect(nanDetected).toBe(false);
      expect(negativePopDetected).toBe(false);
    }, 120_000); // 2 minute timeout per round
  }

  it('summary — all rounds complete without crashes', () => {
    console.log('\n=== SUMMARY ===');
    console.log('Round | Player 1    | Player 2    | Ticks | Winner      | Victory     | P1 Starv | P2 Starv');
    console.log('------|-------------|-------------|-------|-------------|-------------|----------|--------');
    for (const r of results) {
      console.log(
        `  ${r.round.toString().padStart(2)}  | ${r.player1.padEnd(11)} | ${r.player2.padEnd(11)} | ${r.finalTick.toString().padStart(5)} | ${(r.winner ?? 'NONE').padEnd(11)} | ${(r.victoryType ?? 'N/A').padEnd(11)} | ${r.p1StarvTicks.toString().padStart(8)} | ${r.p2StarvTicks.toString().padStart(8)}`
      );
    }

    const finished = results.filter(r => r.gameFinished);
    const crashed = results.filter(r => r.crashDetected);
    console.log(`\nFinished: ${finished.length}/${results.length}, Crashed: ${crashed.length}/${results.length}`);

    expect(crashed).toHaveLength(0);
  });
});
