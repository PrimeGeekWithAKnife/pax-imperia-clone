/**
 * Conquest & Diplomatic Victory Playtest — isolated paths
 *
 * Runs games with ONLY conquest or ONLY diplomatic victory enabled
 * to understand why these paths never trigger:
 *
 * Part A: 5 conquest-only games (small galaxy, 2 aggressive AI players)
 * Part B: 5 diplomatic-only games (small galaxy, 2 diplomatic AI players)
 *
 * Logs detailed progress: fleet sizes, wars declared, planets conquered,
 * alliance proposals, diplomatic relations, victory progress %.
 */

import { describe, it, expect } from 'vitest';
import { initializeGame, type GameSetupConfig } from '../engine/game-init.js';
import {
  processGameTick,
  initializeTickState,
  type GameTickState,
} from '../engine/game-loop.js';
import { calculateVictoryProgress } from '../engine/victory.js';
import { PREBUILT_SPECIES_BY_ID } from '../../data/species/index.js';
import techTreeData from '../../data/tech/universal-tree.json';
import type { Technology } from '../types/technology.js';
import type { GameEvent } from '../types/events.js';

const allTechs = (techTreeData as unknown as { technologies: Technology[] }).technologies;
const MAX_TICKS = 10_000;

// Conquest matchups — pick species with high combat traits
const CONQUEST_MATCHUPS: [string, string][] = [
  ['drakmari', 'khazari'],    // combat 9 vs combat 9
  ['orivani', 'zorvathi'],    // combat 8 vs combat 6
  ['teranos', 'pyrenth'],     // combat 5 vs combat 8
  ['drakmari', 'teranos'],    // predator vs human
  ['khazari', 'orivani'],     // forge lords vs zealots
];

// Diplomatic matchups — pick species with high diplomacy traits
const DIPLO_MATCHUPS: [string, string][] = [
  ['vethara', 'teranos'],     // diplomacy 8 vs diplomacy 7
  ['ashkari', 'sylvani'],     // diplomacy 7 vs diplomacy 7
  ['teranos', 'vaelori'],     // diplomacy 7 vs diplomacy 6
  ['vethara', 'ashkari'],     // diplomacy 8 vs diplomacy 7
  ['sylvani', 'luminari'],    // diplomacy 7 vs diplomacy 6
];

function runGame(
  matchup: [string, string],
  victoryCriteria: string[],
  label: string,
) {
  const sp1 = PREBUILT_SPECIES_BY_ID[matchup[0]];
  const sp2 = PREBUILT_SPECIES_BY_ID[matchup[1]];

  const config: GameSetupConfig = {
    galaxyConfig: {
      shape: 'spiral' as const,
      size: 'small' as const,
      density: 'normal' as const,
      playerCount: 2,
      seed: label.charCodeAt(0) * 1000 + label.charCodeAt(label.length - 1),
    },
    players: [
      { empireName: sp1.name, species: sp1, color: '#4488ff', isAI: true },
      { empireName: sp2.name, species: sp2, color: '#ff4444', isAI: true },
    ],
    victoryCriteria,
  };

  const gameState = initializeGame(config);
  let state = initializeTickState(gameState);
  const e1 = gameState.empires[0];
  const e2 = gameState.empires[1];

  let winner: string | null = null;
  let victoryType: string | null = null;
  let gameFinished = false;

  // Event counters
  let warsDeclared = 0;
  let combatEvents = 0;
  let planetsConquered = 0;
  let alliancesFormed = 0;
  let treatiesCount = 0;

  for (let t = 0; t < MAX_TICKS; t++) {
    const result = processGameTick(state, allTechs);
    state = result.newState;

    // Track events
    for (const evt of result.events) {
      const e = evt as any;
      if (e.type === 'GameOver') {
        winner = e.winnerEmpireId;
        victoryType = e.victoryCriteria;
        gameFinished = true;
      }
      if (e.type === 'WarDeclared') warsDeclared++;
      if (e.type === 'CombatResolved' || e.type === 'CombatStarted') combatEvents++;
      if (e.type === 'PlanetConquered') planetsConquered++;
      if (e.type === 'AllianceFormed' || e.type === 'TreatyAccepted') alliancesFormed++;
    }
    if (state.gameState.status === 'finished') gameFinished = true;

    // Log progress at milestones
    if ([499, 999, 2499, 4999, 7499, 9999].includes(t)) {
      const planets = state.gameState.galaxy.systems.flatMap(s => s.planets);
      const p1Planets = planets.filter(p => p.ownerId === e1.id);
      const p2Planets = planets.filter(p => p.ownerId === e2.id);
      const totalColonised = planets.filter(p => p.ownerId !== null).length;

      // Fleet counts
      const p1Fleets = state.gameState.fleets.filter(f => f.empireId === e1.id);
      const p2Fleets = state.gameState.fleets.filter(f => f.empireId === e2.id);
      const p1Ships = state.gameState.ships?.filter(s => p1Fleets.some(f => f.id === s.fleetId))?.length ?? 0;
      const p2Ships = state.gameState.ships?.filter(s => p2Fleets.some(f => f.id === s.fleetId))?.length ?? 0;

      // Diplomatic state
      const e1Diplo = state.gameState.empires.find(e => e.id === e1.id)?.diplomacy ?? [];
      const e2Diplo = state.gameState.empires.find(e => e.id === e2.id)?.diplomacy ?? [];
      const e1Rel = e1Diplo.find(r => r.empireId === e2.id);
      const e2Rel = e2Diplo.find(r => r.empireId === e1.id);

      // Victory progress
      const allEmpires = state.gameState.empires;
      const conquestProg1 = p1Planets.length > 0 && totalColonised > 0
        ? Math.round((p1Planets.length / totalColonised) * 100)
        : 0;
      const conquestProg2 = p2Planets.length > 0 && totalColonised > 0
        ? Math.round((p2Planets.length / totalColonised) * 100)
        : 0;

      console.log(`  t=${t+1}:`);
      console.log(`    ${sp1.name}: ${p1Planets.length} cols, ${p1Ships} ships, ${p1Fleets.length} fleets`);
      console.log(`    ${sp2.name}: ${p2Planets.length} cols, ${p2Ships} ships, ${p2Fleets.length} fleets`);
      console.log(`    Territory: ${sp1.name} ${conquestProg1}% / ${sp2.name} ${conquestProg2}% of ${totalColonised} colonised`);
      console.log(`    Diplomacy: ${sp1.name}→${sp2.name}: ${e1Rel?.status ?? 'none'} (treaties: ${e1Rel?.treaties?.length ?? 0})`);
      console.log(`    Events so far: wars=${warsDeclared} combats=${combatEvents} conquered=${planetsConquered} alliances=${alliancesFormed}`);
    }

    if (gameFinished) break;
  }

  const winnerName = winner === e1.id ? sp1.name : winner === e2.id ? sp2.name : 'NONE';

  return {
    sp1Name: sp1.name,
    sp2Name: sp2.name,
    finalTick: state.gameState.currentTick,
    winner: winnerName,
    victoryType,
    gameFinished,
    warsDeclared,
    combatEvents,
    planetsConquered,
    alliancesFormed,
  };
}

describe('Part A: Conquest-only victory (5 rounds)', () => {
  for (let i = 0; i < CONQUEST_MATCHUPS.length; i++) {
    const [id1, id2] = CONQUEST_MATCHUPS[i];
    it(`Conquest ${i+1}: ${PREBUILT_SPECIES_BY_ID[id1].name} vs ${PREBUILT_SPECIES_BY_ID[id2].name}`, () => {
      console.log(`\n=== Conquest ${i+1}: ${id1} vs ${id2} ===`);
      const result = runGame(CONQUEST_MATCHUPS[i], ['conquest'], `conquest${i}`);
      console.log(`  RESULT: ${result.gameFinished ? `${result.winner} wins by ${result.victoryType} at tick ${result.finalTick}` : `NO WINNER after ${MAX_TICKS} ticks`}`);
      console.log(`  Events: wars=${result.warsDeclared} combats=${result.combatEvents} conquered=${result.planetsConquered}`);

      // Don't assert victory — we want to observe what happens
      expect(true).toBe(true);
    }, 120_000);
  }
});

describe('Part B: Diplomatic-only victory (5 rounds)', () => {
  for (let i = 0; i < DIPLO_MATCHUPS.length; i++) {
    const [id1, id2] = DIPLO_MATCHUPS[i];
    it(`Diplomatic ${i+1}: ${PREBUILT_SPECIES_BY_ID[id1].name} vs ${PREBUILT_SPECIES_BY_ID[id2].name}`, () => {
      console.log(`\n=== Diplomatic ${i+1}: ${id1} vs ${id2} ===`);
      const result = runGame(DIPLO_MATCHUPS[i], ['diplomatic'], `diplo${i}`);
      console.log(`  RESULT: ${result.gameFinished ? `${result.winner} wins by ${result.victoryType} at tick ${result.finalTick}` : `NO WINNER after ${MAX_TICKS} ticks`}`);
      console.log(`  Events: alliances=${result.alliancesFormed} wars=${result.warsDeclared}`);

      expect(true).toBe(true);
    }, 120_000);
  }
});
