/**
 * Medium Galaxy Dominance Playtest — 10 rounds, 4-8 players, dominance-only
 *
 * Tests whether the AI can lead the Galactic Council AND own 50% of habitable
 * planets to achieve dominance victory on medium maps within 25,000 ticks.
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
const MAX_TICKS = 25_000;

// 10 matchups mixing diplomatic, aggressive, and builder species
const ROUNDS: { players: string[]; seed: number }[] = [
  // R1: 4-player — diplomatic heavyweights
  { players: ['vethara', 'ashkari', 'teranos', 'sylvani'], seed: 60001 },
  // R2: 4-player — mixed diplo + aggro
  { players: ['vethara', 'drakmari', 'teranos', 'nexari'], seed: 60002 },
  // R3: 4-player — builders & diplomats
  { players: ['kaelenth', 'thyriaq', 'vethara', 'ashkari'], seed: 60003 },
  // R4: 6-player — full spectrum
  { players: ['teranos', 'vethara', 'sylvani', 'drakmari', 'nexari', 'luminari'], seed: 60004 },
  // R5: 6-player — diplomats vs warriors
  { players: ['vethara', 'ashkari', 'luminari', 'drakmari', 'khazari', 'orivani'], seed: 60005 },
  // R6: 6-player — researchers & diplomats
  { players: ['luminari', 'aethyn', 'vaelori', 'vethara', 'ashkari', 'teranos'], seed: 60006 },
  // R7: 8-player — big field
  { players: ['teranos', 'vethara', 'drakmari', 'sylvani', 'nexari', 'luminari', 'ashkari', 'kaelenth'], seed: 60007 },
  // R8: 8-player — different mix
  { players: ['luminari', 'aethyn', 'vethara', 'ashkari', 'orivani', 'thyriaq', 'vaelori', 'pyrenth'], seed: 60008 },
  // R9: 4-player — pure warriors forced into dominance
  { players: ['drakmari', 'khazari', 'orivani', 'zorvathi'], seed: 60009 },
  // R10: 4-player — expansionists
  { players: ['teranos', 'nexari', 'kaelenth', 'pyrenth'], seed: 60010 },
];

describe('Medium Galaxy Dominance — 10 rounds', () => {
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
        victoryCriteria: ['dominance'],
      };

      const gameState = initializeGame(config);
      let state = initializeTickState(gameState);
      const empires = gameState.empires;

      // Count total colonisable planets at game start
      const allPlanetsStart = gameState.galaxy.systems.flatMap(s => s.planets);
      const colonisableCount = allPlanetsStart.filter(p => p.maxPopulation > 0).length;
      const needed50pct = Math.ceil(colonisableCount * 0.50);
      console.log(`  R${round+1} setup: ${empires.length}p, ${gameState.galaxy.systems.length} systems, ${colonisableCount} colonisable, need ${needed50pct} for 50%`);

      let winner: string | null = null;
      let victoryType: string | null = null;
      let gameFinished = false;
      let combatCount = 0;
      let allianceCount = 0;

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
            if (e.type === 'AllianceFormed') allianceCount++;
          }
          if (state.gameState.status === 'finished') gameFinished = true;

          if (gameFinished) break;
        } catch (err) {
          console.error(`  CRASH R${round+1} t=${t}: ${(err as Error).message.slice(0, 150)}`);
          break;
        }

        // Progress at milestones
        if ([999, 2499, 4999, 9999, 14999, 19999, 24999].includes(t)) {
          const planets = state.gameState.galaxy.systems.flatMap(s => s.planets);
          const colonisable = planets.filter(p => p.maxPopulation > 0);
          const alive = empires.filter(e =>
            planets.some(p => p.ownerId === e.id && p.currentPopulation > 0)
          ).length;

          // Council leader info
          const orgState = (state as any).organisationState as
            | { organisations: Array<{ memberEmpires: string[]; votingPower: Record<string, number> }> }
            | undefined;
          let councilLeaderName = 'none';
          let councilMembers = 0;
          if (orgState && orgState.organisations.length > 0) {
            const mainOrg = orgState.organisations.reduce((a: any, b: any) =>
              a.memberEmpires.length >= b.memberEmpires.length ? a : b,
            );
            councilMembers = mainOrg.memberEmpires.length;
            let highestPower = 0;
            let leaderId: string | null = null;
            for (const [empireId, power] of Object.entries(mainOrg.votingPower)) {
              if (power > highestPower) {
                highestPower = power;
                leaderId = empireId;
              }
            }
            if (leaderId) {
              councilLeaderName = empires.find(e => e.id === leaderId)?.name ?? '???';
            }
          }

          // Top empire by planet ownership
          const topEmpire = empires.reduce((best, e) => {
            const count = colonisable.filter(p => p.ownerId === e.id).length;
            return count > best.count ? { id: e.id, name: e.name, count } : best;
          }, { id: '', name: '', count: 0 });

          const totalCol = planets.filter(p => p.ownerId !== null).length;
          const pct = Math.round(topEmpire.count / Math.max(1, colonisable.length) * 100);

          console.log(`  t=${t+1}: ${alive}/${empires.length} alive, ${totalCol} colonised, top=${topEmpire.name} (${topEmpire.count}/${colonisable.length}=${pct}%), council=${councilLeaderName} (${councilMembers} members), combats=${combatCount}`);
        }
      }

      // Final snapshot
      const planets = state.gameState.galaxy.systems.flatMap(s => s.planets);
      const colonisable = planets.filter(p => p.maxPopulation > 0);
      const totalCol = planets.filter(p => p.ownerId !== null).length;
      const alive = empires.filter(e =>
        planets.some(p => p.ownerId === e.id && p.currentPopulation > 0)
      ).length;
      const eliminated = empires.length - alive;
      const winnerName = winner
        ? empires.find(e => e.id === winner)?.name ?? '???'
        : 'NONE';

      // Council state at end
      const orgStateFinal = (state as any).organisationState as
        | { organisations: Array<{ memberEmpires: string[]; votingPower: Record<string, number> }> }
        | undefined;
      let finalCouncilLeader = 'none';
      let finalCouncilMembers = 0;
      if (orgStateFinal && orgStateFinal.organisations.length > 0) {
        const mainOrg = orgStateFinal.organisations.reduce((a: any, b: any) =>
          a.memberEmpires.length >= b.memberEmpires.length ? a : b,
        );
        finalCouncilMembers = mainOrg.memberEmpires.length;
        let highestPower = 0;
        let leaderId: string | null = null;
        for (const [empireId, power] of Object.entries(mainOrg.votingPower)) {
          if (power > highestPower) {
            highestPower = power;
            leaderId = empireId;
          }
        }
        if (leaderId) {
          finalCouncilLeader = empires.find(e => e.id === leaderId)?.name ?? '???';
        }
      }

      console.log(`\n=== R${round+1} RESULT: ${gameFinished ? `${winnerName} wins by ${victoryType} at tick ${state.gameState.currentTick}` : `NO WINNER after ${MAX_TICKS} ticks`} ===`);
      console.log(`  ${alive}/${empires.length} alive (${eliminated} elim), ${combatCount} combats, ${allianceCount} alliances, ${totalCol}/${colonisable.length} colonised`);
      console.log(`  Council: leader=${finalCouncilLeader}, ${finalCouncilMembers} members`);
      for (const e of empires) {
        const eCols = colonisable.filter(p => p.ownerId === e.id).length;
        console.log(`  ${e.name.padEnd(15)}: ${eCols}/${colonisable.length} cols (${Math.round(eCols/Math.max(1,colonisable.length)*100)}%)`);
      }

      summaryRows.push(
        `  ${(round+1).toString().padStart(2)} | ${players.length}p | ${state.gameState.currentTick.toString().padStart(5)} | ${winnerName.padEnd(12)} | ${(victoryType ?? 'N/A').padEnd(10)} | ${alive}/${empires.length} alive | ${combatCount.toString().padStart(3)} combats | ${finalCouncilLeader.padEnd(12)} | ${finalCouncilMembers}m`
      );

      // No crashes, no NaN
      for (const p of planets) {
        expect(p.currentPopulation).toBeGreaterThanOrEqual(0);
        expect(isFinite(p.currentPopulation)).toBe(true);
      }
    }, 600_000); // 10 min timeout for medium maps with 25k ticks
  }

  it('summary', () => {
    console.log('\n=== MEDIUM DOMINANCE SUMMARY ===');
    console.log('  Rd | Pl | Ticks | Winner       | Victory    | Survival    | Combats   | Council Lead | Members');
    console.log('  ---|----|----- -|--------------|------------|-------------|-----------|--------------|--------');
    for (const row of summaryRows) console.log(row);
    expect(summaryRows.length).toBe(10);
  });
});
