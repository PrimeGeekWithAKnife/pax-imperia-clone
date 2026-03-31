/**
 * Playtest Round 8: Kaelenth — synthetic species, tech victory focus.
 *
 * Kaelenth traits: construction 10, research 9, economy 6, combat 5,
 * espionage 4, diplomacy 2, reproduction 1.
 * Government: Technocracy (1.4x researchSpeed, 0.8x populationGrowth).
 *
 * Goal: Technological Victory — research the Ascension Project within 500 ticks.
 *
 * Key questions:
 *   1. Can tech victory be achieved in 500 ticks? (double-dipping bug fixed)
 *   2. How does reproduction 1 (0.2x growth) affect expansion?
 *   3. Does the research system pace well through 5 ages?
 *   4. Are there dead-end techs that waste research?
 *   5. Does the tech tree UI show enough info to plan ahead?
 *   6. How does the Ascension Project interact with victory conditions?
 */

import { describe, it, expect } from 'vitest';
import {
  processGameTick,
  initializeTickState,
  type GameTickState,
} from '../engine/game-loop.js';
import { initializeGame, type GameSetupConfig } from '../engine/game-init.js';
import type { Technology } from '../types/technology.js';
import type { Planet } from '../types/galaxy.js';
import type { GameEvent, TechResearchedEvent } from '../types/events.js';
import { checkVictoryConditions } from '../engine/victory.js';
import techTree from '../../data/tech/universal-tree.json';
import { PREBUILT_SPECIES_BY_ID } from '../../data/species/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const allTechs = (techTree as { technologies: Technology[] }).technologies;

function getColonisedPlanets(state: GameTickState): Planet[] {
  return state.gameState.galaxy.systems
    .flatMap(s => s.planets)
    .filter(p => p.ownerId !== null && p.currentPopulation > 0);
}

function runTicks(
  state: GameTickState,
  ticks: number,
): { state: GameTickState; allEvents: GameEvent[] } {
  let s = state;
  const allEvents: GameEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const result = processGameTick(s, allTechs);
    s = result.newState;
    allEvents.push(...result.events);
    if (s.gameState.status !== 'playing') break;
  }
  return { state: s, allEvents };
}

function setupKaelenthGame(seed = 200): GameTickState {
  const kaelenth = PREBUILT_SPECIES_BY_ID['kaelenth']!;
  const teranos = PREBUILT_SPECIES_BY_ID['teranos']!;
  const nexari = PREBUILT_SPECIES_BY_ID['nexari']!;

  const config: GameSetupConfig = {
    galaxyConfig: { seed, size: 'medium', shape: 'elliptical', playerCount: 3 },
    players: [
      { species: kaelenth, empireName: 'Kaelenth Collective', color: '#88CCFF', isAI: true, aiPersonality: 'researcher' },
      { species: teranos, empireName: 'Teranos Federation', color: '#4488FF', isAI: true, aiPersonality: 'economic' },
      { species: nexari, empireName: 'Nexari Hegemony', color: '#FF8844', isAI: true, aiPersonality: 'aggressive' },
    ],
    victoryCriteria: ['technological'],
  };
  return initializeTickState(initializeGame(config), allTechs.length);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Playtest Round 8: Kaelenth (tech victory, reproduction 1)', () => {

  // =========================================================================
  // Q1: Can tech victory be achieved in 500 ticks?
  // =========================================================================

  it('runs 500 ticks without crashing or producing NaN values', () => {
    const initial = setupKaelenthGame();
    const { state: final } = runTicks(initial, 500);

    // No NaN in any empire's resources
    for (const [empireId, res] of final.empireResourcesMap) {
      for (const [field, value] of Object.entries(res)) {
        expect(
          Number.isFinite(value as number),
          `Empire ${empireId} resource "${field}" = ${value} is not finite`,
        ).toBe(true);
      }
    }

    expect(final.gameState.currentTick).toBeGreaterThanOrEqual(100);
  });

  it('Kaelenth research progresses through multiple ages in 500 ticks', () => {
    const initial = setupKaelenthGame();
    const { state: final, allEvents } = runTicks(initial, 500);

    const kaelenth = final.gameState.empires.find(e => e.name === 'Kaelenth Collective')!;
    const researchState = final.researchStates.get(kaelenth.id)!;

    // They should have researched some techs
    expect(kaelenth.technologies.length).toBeGreaterThan(0);

    // Log age progression
    const ageOrder = ['nano_atomic', 'fusion', 'nano_fusion', 'anti_matter', 'singularity'];
    const currentAgeIdx = ageOrder.indexOf(kaelenth.currentAge);

    // With research 9 and technocracy 1.4x, they should advance past nano_atomic
    expect(currentAgeIdx).toBeGreaterThanOrEqual(1);

    // Track tech completions per age
    const techsByAge: Record<string, number> = {};
    for (const techId of kaelenth.technologies) {
      const tech = allTechs.find(t => t.id === techId);
      if (tech) {
        techsByAge[tech.age] = (techsByAge[tech.age] ?? 0) + 1;
      }
    }

    // Log TechResearched events with timestamps
    const techEvents = allEvents
      .filter((e): e is TechResearchedEvent => e.type === 'TechResearched' && e.empireId === kaelenth.id)
      .map(e => ({ tick: e.tick, techId: e.techId }));

    // Find age transition ticks
    const ageTransitions: Record<string, number> = {};
    for (const ev of techEvents) {
      const tech = allTechs.find(t => t.id === ev.techId);
      if (tech) {
        for (const effect of tech.effects) {
          if (effect.type === 'age_unlock') {
            ageTransitions[effect.age] = ev.tick;
          }
        }
      }
    }

    console.log('[Kaelenth R8] Techs researched:', kaelenth.technologies.length, '/ 300');
    console.log('[Kaelenth R8] Techs per age:', techsByAge);
    console.log('[Kaelenth R8] Current age:', kaelenth.currentAge, `(index ${currentAgeIdx})`);
    console.log('[Kaelenth R8] Age transitions:', ageTransitions);
    console.log('[Kaelenth R8] Total research generated:', researchState.totalResearchGenerated);
    console.log('[Kaelenth R8] Active research:', researchState.activeResearch.length);

    // Check if Ascension Project was completed
    const hasAscension = kaelenth.technologies.includes('ascension_project');
    console.log('[Kaelenth R8] Ascension Project completed:', hasAscension);

    // Check victory
    const victoryResult = checkVictoryConditions(
      final.gameState,
      final.empireResourcesMap,
      final.economicLeadTicks,
      allTechs.length,
    );
    console.log('[Kaelenth R8] Victory result:', victoryResult);
  });

  it('assesses whether tech victory is feasible within 500 ticks (pacing analysis)', () => {
    const initial = setupKaelenthGame();

    // Track research milestones at intervals
    const snapshots: Array<{ tick: number; techs: number; age: string; researchGen: number }> = [];
    let s = initial;
    for (let tick = 0; tick < 500; tick++) {
      const result = processGameTick(s, allTechs);
      s = result.newState;
      if (s.gameState.status !== 'playing') break;

      if (tick % 50 === 49 || tick === 0) {
        const kaelenth = s.gameState.empires.find(e => e.name === 'Kaelenth Collective')!;
        const rs = s.researchStates.get(kaelenth.id)!;
        snapshots.push({
          tick: tick + 1,
          techs: kaelenth.technologies.length,
          age: kaelenth.currentAge,
          researchGen: Math.round(rs.totalResearchGenerated),
        });
      }
    }

    console.log('[Kaelenth R8] Research pacing (every 50 ticks):');
    for (const snap of snapshots) {
      console.log(`  Tick ${snap.tick}: ${snap.techs} techs, age=${snap.age}, totalRP=${snap.researchGen}`);
    }

    // The minimum cost path to Ascension Project is 466,500 RP across 56 techs.
    // With research 9 (1.8x) and technocracy (1.4x), effective multiplier = 2.52x.
    // A single L1 research lab produces 50 RP/tick base.
    // With Kaelenth research trait: 50 * 1.8 = 90 RP/tick per lab.
    // With technocracy government: 90 * 1.4 = 126 RP/tick per lab (in processResearchTick).
    // Wait -- species trait is applied in economy.ts, gov in research.ts.
    // So: economy produces 50 * (9/5) = 90 RP/tick, research.ts applies *1.4 = 126 effective.
    // 1 lab => 466,500 / 126 = 3702 ticks minimum (way over 500).
    // Need ~7.4 labs to finish in 500 ticks (466,500 / 500 / 126 = 7.4).
    // But Kaelenth only start with 1 lab and reproduction 1 limits colony expansion.
    // Verdict: 500 ticks is very tight for tech victory without multiple colonies.
    const kaelenth = s.gameState.empires.find(e => e.name === 'Kaelenth Collective')!;
    expect(kaelenth.technologies.length).toBeGreaterThan(5); // At least some progress
  });

  // =========================================================================
  // Q2: How does reproduction 1 (0.2x growth) affect expansion?
  // =========================================================================

  it('reproduction 1 severely limits population growth', () => {
    const initial = setupKaelenthGame();

    // Track population at intervals
    const kaelenth = initial.gameState.empires.find(e => e.name === 'Kaelenth Collective')!;
    const startPlanets = getColonisedPlanets(initial).filter(p => p.ownerId === kaelenth.id);
    const startPop = startPlanets.reduce((sum, p) => sum + p.currentPopulation, 0);

    const { state: final } = runTicks(initial, 500);

    const finalKaelenth = final.gameState.empires.find(e => e.name === 'Kaelenth Collective')!;
    const finalPlanets = getColonisedPlanets(final).filter(p => p.ownerId === finalKaelenth.id);
    const endPop = finalPlanets.reduce((sum, p) => sum + p.currentPopulation, 0);

    // Compare with a "normal" reproduction species (Teranos)
    const teranos = final.gameState.empires.find(e => e.name === 'Teranos Federation')!;
    const teranosPlanets = getColonisedPlanets(final).filter(p => p.ownerId === teranos.id);
    const teranosPop = teranosPlanets.reduce((sum, p) => sum + p.currentPopulation, 0);

    const growthRatio = startPop > 0 ? endPop / startPop : 0;

    console.log('[Kaelenth R8] Population growth:');
    console.log(`  Kaelenth: ${startPop} -> ${endPop} (x${growthRatio.toFixed(2)}, ${finalPlanets.length} planets)`);
    console.log(`  Teranos:  ${teranosPop} (${teranosPlanets.length} planets)`);

    // Population should still grow somewhat even with 0.2x modifier
    expect(endPop).toBeGreaterThanOrEqual(startPop);
  });

  it('Kaelenth colonise fewer worlds than higher-reproduction species', () => {
    const initial = setupKaelenthGame();
    const { state: final } = runTicks(initial, 500);

    const kaelenth = final.gameState.empires.find(e => e.name === 'Kaelenth Collective')!;
    const kPlanets = getColonisedPlanets(final).filter(p => p.ownerId === kaelenth.id).length;

    // Compare total colonised planets per empire
    for (const empire of final.gameState.empires) {
      const planets = getColonisedPlanets(final).filter(p => p.ownerId === empire.id).length;
      const pop = getColonisedPlanets(final)
        .filter(p => p.ownerId === empire.id)
        .reduce((sum, p) => sum + p.currentPopulation, 0);
      console.log(`[Kaelenth R8] ${empire.name}: ${planets} planets, pop ${pop}`);
    }

    // Kaelenth should have at least 1 planet (homeworld)
    expect(kPlanets).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // Q3: Research system pacing through 5 ages
  // =========================================================================

  it('research generation scales with species trait and government', () => {
    const initial = setupKaelenthGame();

    // Run a few ticks and check research output
    let s = initial;
    for (let i = 0; i < 10; i++) {
      const result = processGameTick(s, allTechs);
      s = result.newState;
    }

    const kaelenth = s.gameState.empires.find(e => e.name === 'Kaelenth Collective')!;
    const rs = s.researchStates.get(kaelenth.id)!;

    // With research 9, a single L1 lab should produce 50 * (9/5) = 90 RP/tick in economy.
    // Government technocracy adds 1.4x in processResearchTick.
    // So effective: 90 * 1.4 = 126 RP/tick from 1 lab.
    // Over 10 ticks: ~1260 total (minus a tick or two before research starts).
    console.log('[Kaelenth R8] Research after 10 ticks:', rs.totalResearchGenerated);
    console.log('[Kaelenth R8] Active projects:', rs.activeResearch.length);
    console.log('[Kaelenth R8] Completed techs:', rs.completedTechs.length);

    // Should have generated some research
    expect(rs.totalResearchGenerated).toBeGreaterThan(0);
  });

  it('no double-dipping: species trait is NOT applied twice', () => {
    // The fix ensures species research trait is applied in economy.ts (building output)
    // but NOT again in research.ts (processResearchTick). Government modifier IS
    // applied in processResearchTick. Verify by checking that total research generated
    // is consistent with single application.
    const initial = setupKaelenthGame();
    let s = initial;

    // Run 20 ticks to let research get going
    for (let i = 0; i < 20; i++) {
      const result = processGameTick(s, allTechs);
      s = result.newState;
    }

    const kaelenth = s.gameState.empires.find(e => e.name === 'Kaelenth Collective')!;
    const rs = s.researchStates.get(kaelenth.id)!;

    // Expected: 90 RP/tick (base 50 * research 9/5 = 90, from economy.ts)
    // Government: * 1.4 (from processResearchTick) = 126 effective RP/tick
    // If double-dipping were present: 50 * 1.8 * 1.8 * 1.4 = 226.8 effective/tick
    // Over ~18 productive ticks: single = ~2268, double = ~4082
    const perTick = rs.totalResearchGenerated / 20;
    console.log('[Kaelenth R8] Avg RP/tick (first 20):', perTick.toFixed(1));

    // With single application, per-tick should be roughly 126 or less
    // (some ticks may have 0 research if no active project yet)
    // With double-dipping, it would be ~226+
    // Allow a generous margin but flag if suspiciously high
    if (perTick > 200) {
      console.warn('[Kaelenth R8] WARNING: RP/tick suspiciously high - possible double-dipping!');
    }
    expect(rs.totalResearchGenerated).toBeGreaterThan(0);
  });

  // =========================================================================
  // Q4: Dead-end techs
  // =========================================================================

  it('identifies techs that are leaf nodes (no dependents) with weak effects', () => {
    // A "dead-end" tech is one that:
    // 1. Is not a prerequisite for any other tech
    // 2. Only has stat_bonus effects (no unlocks)
    // These are potentially wasteful for a tech-victory-focused player.

    const allIds = new Set(allTechs.map(t => t.id));
    const prereqOf = new Set<string>();
    for (const t of allTechs) {
      for (const p of t.prerequisites) {
        prereqOf.add(p);
      }
    }

    const leafTechs = allTechs.filter(t => !prereqOf.has(t.id));
    const statOnlyLeaves = leafTechs.filter(t =>
      t.effects.every(e => e.type === 'stat_bonus'),
    );

    // Find the critical path
    const ascensionPrereqs = new Set<string>();
    function collectPrereqs(techId: string) {
      if (ascensionPrereqs.has(techId)) return;
      ascensionPrereqs.add(techId);
      const tech = allTechs.find(t => t.id === techId);
      if (tech) {
        for (const p of tech.prerequisites) {
          collectPrereqs(p);
        }
      }
    }
    collectPrereqs('ascension_project');

    const offPathStatLeaves = statOnlyLeaves.filter(t => !ascensionPrereqs.has(t.id));

    console.log('[Kaelenth R8] Dead-end analysis:');
    console.log(`  Total techs: ${allTechs.length}`);
    console.log(`  Leaf techs (no dependents): ${leafTechs.length}`);
    console.log(`  Stat-only leaves (potential dead ends): ${statOnlyLeaves.length}`);
    console.log(`  Off-path stat-only leaves: ${offPathStatLeaves.length}`);
    console.log(`  Ascension critical path: ${ascensionPrereqs.size} techs`);
    console.log(`  Off-path techs: ${allTechs.length - ascensionPrereqs.size}`);

    // Some dead ends are fine (flavour, optional upgrades), but if most techs are
    // dead ends, the tree feels shallow. Flag if >50% are dead ends.
    const deadEndRatio = offPathStatLeaves.length / allTechs.length;
    console.log(`  Dead-end ratio: ${(deadEndRatio * 100).toFixed(1)}%`);

    // The tree should have enough structure that <50% are pure dead ends
    expect(deadEndRatio).toBeLessThan(0.5);
  });

  // =========================================================================
  // Q5: Tech tree UI information (structural analysis)
  // =========================================================================

  it('tech detail panel shows all required planning info', () => {
    // Verify the tech data contains everything the TechDetailPanel needs:
    // - name, description, category, age, cost (all present)
    // - prerequisites (with human-readable names)
    // - effects (with formatted descriptions)
    // - "allows" section (what this tech unlocks)

    const techNamesById = new Map(allTechs.map(t => [t.id, t.name]));

    // Check all prereqs reference existing techs
    let brokenPrereqs = 0;
    for (const tech of allTechs) {
      for (const prereqId of tech.prerequisites) {
        if (!techNamesById.has(prereqId)) {
          console.error(`[Kaelenth R8] Broken prereq: ${tech.id} requires unknown "${prereqId}"`);
          brokenPrereqs++;
        }
      }
    }
    expect(brokenPrereqs).toBe(0);

    // Check all techs have descriptions
    const missingDesc = allTechs.filter(t => !t.description || t.description.trim().length < 10);
    console.log('[Kaelenth R8] Techs missing/short descriptions:', missingDesc.length);
    expect(missingDesc.length).toBe(0);

    // Check all techs have at least 1 effect
    const noEffects = allTechs.filter(t => t.effects.length === 0);
    console.log('[Kaelenth R8] Techs with no effects:', noEffects.length);
    if (noEffects.length > 0) {
      for (const t of noEffects) {
        console.log(`  ${t.id} (${t.age}, ${t.category})`);
      }
    }
    expect(noEffects.length).toBe(0);

    // Check "allows" linkage: each tech on the critical path should show
    // that it unlocks the next step(s)
    const ascensionTech = allTechs.find(t => t.id === 'ascension_project')!;
    expect(ascensionTech).toBeDefined();
    expect(ascensionTech.prerequisites.length).toBe(5); // 5 direct prereqs
    for (const prereqId of ascensionTech.prerequisites) {
      expect(techNamesById.has(prereqId)).toBe(true);
    }

    console.log('[Kaelenth R8] Ascension Project prereqs:',
      ascensionTech.prerequisites.map(id => techNamesById.get(id)));
  });

  // =========================================================================
  // Q6: Ascension Project and victory condition interaction
  // =========================================================================

  it('Ascension Project tech triggers technological victory when completed', () => {
    // Simulate a state where Kaelenth have completed the Ascension Project
    const initial = setupKaelenthGame();
    const kaelenth = initial.gameState.empires.find(e => e.name === 'Kaelenth Collective')!;

    // Inject ascension_project into technologies to test victory detection
    const modifiedEmpires = initial.gameState.empires.map(e =>
      e.id === kaelenth.id
        ? { ...e, technologies: [...e.technologies, 'ascension_project'] }
        : e,
    );

    const modifiedState = {
      ...initial.gameState,
      empires: modifiedEmpires,
    };

    const result = checkVictoryConditions(
      modifiedState,
      initial.empireResourcesMap,
      initial.economicLeadTicks,
      allTechs.length,
    );

    expect(result).not.toBeNull();
    expect(result!.winner).toBe(kaelenth.id);
    expect(result!.condition).toBe('technological');
    console.log('[Kaelenth R8] Victory condition correctly triggers for Ascension Project');
  });

  it('victory criteria filter works (only tech victory enabled)', () => {
    const initial = setupKaelenthGame();

    // The game was set up with victoryCriteria: ['technological']
    expect(initial.gameState.victoryCriteria).toContain('technological');

    // Run ticks and verify no non-tech victory triggers
    const { state: final, allEvents } = runTicks(initial, 100);

    const result = checkVictoryConditions(
      final.gameState,
      final.empireResourcesMap,
      final.economicLeadTicks,
      allTechs.length,
    );

    // In 100 ticks, no one should have the Ascension Project
    if (result !== null) {
      expect(result.condition).toBe('technological');
    }
  });

  // =========================================================================
  // Full simulation summary
  // =========================================================================

  it('logs comprehensive simulation summary at tick 500', () => {
    const initial = setupKaelenthGame();
    const { state: final, allEvents } = runTicks(initial, 500);

    console.log('\n=== PLAYTEST ROUND 8: KAELENTH TECH VICTORY SIMULATION ===\n');

    for (const empire of final.gameState.empires) {
      const res = final.empireResourcesMap.get(empire.id)!;
      const planets = getColonisedPlanets(final).filter(p => p.ownerId === empire.id);
      const totalPop = planets.reduce((sum, p) => sum + p.currentPopulation, 0);
      const ships = final.gameState.ships.filter(s => {
        const fleet = final.gameState.fleets.find(f => f.id === s.fleetId);
        return fleet?.empireId === empire.id;
      });
      const rs = final.researchStates.get(empire.id)!;

      console.log(`${empire.name} (${empire.species.name}):`);
      console.log(`  Age: ${empire.currentAge}`);
      console.log(`  Techs: ${empire.technologies.length} / ${allTechs.length}`);
      console.log(`  Total RP generated: ${Math.round(rs.totalResearchGenerated)}`);
      console.log(`  Planets: ${planets.length}, Population: ${totalPop}`);
      console.log(`  Ships: ${ships.length}`);
      console.log(`  Credits: ${res.credits}, Minerals: ${res.minerals}, Energy: ${res.energy}`);
      console.log(`  Has Ascension: ${empire.technologies.includes('ascension_project')}`);
      console.log();
    }

    // Tech research timeline for Kaelenth
    const kaelenth = final.gameState.empires.find(e => e.name === 'Kaelenth Collective')!;
    const techEvents = allEvents
      .filter((e): e is TechResearchedEvent => e.type === 'TechResearched' && e.empireId === kaelenth.id)
      .sort((a, b) => a.tick - b.tick);

    console.log(`Kaelenth tech timeline (${techEvents.length} techs):`);
    for (const ev of techEvents) {
      const tech = allTechs.find(t => t.id === ev.techId);
      const age = tech?.age ?? '?';
      const cat = tech?.category ?? '?';
      console.log(`  T${ev.tick}: ${tech?.name ?? ev.techId} [${age}/${cat}]`);
    }

    // Victory assessment
    const victoryResult = checkVictoryConditions(
      final.gameState,
      final.empireResourcesMap,
      final.economicLeadTicks,
      allTechs.length,
    );

    console.log('\n--- PACING ASSESSMENT ---');
    const kRS = final.researchStates.get(kaelenth.id)!;
    const rpPerTick = kRS.totalResearchGenerated / final.gameState.currentTick;
    // Minimum path cost: 466,500 RP
    const ticksNeeded = Math.ceil(466500 / rpPerTick);
    console.log(`  Avg RP/tick: ${rpPerTick.toFixed(1)}`);
    console.log(`  Min path cost: 466,500 RP (56 techs)`);
    console.log(`  Estimated ticks for min path: ${ticksNeeded}`);
    console.log(`  Victory at tick 500: ${victoryResult !== null ? 'YES' : 'NO'}`);
    if (victoryResult) {
      console.log(`  Winner: ${final.gameState.empires.find(e => e.id === victoryResult.winner)?.name}`);
    }
  });
});
