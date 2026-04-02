/**
 * Galactic Council V2 Engine
 *
 * Full governance system with:
 *  - Bill lifecycle: propose → canvass → vote → resolve
 *  - Graduated sanctions: condemn → financial → sanctions → suspension → expulsion
 *  - Member benefits computed per tick
 *  - Leader veto with popularity consequences
 *  - Psychology-driven AI voting on bills
 *  - Council-authorised war
 */

import type {
  CouncilStateV2,
  CouncilBill,
  BillType,
  BillPhase,
  CouncilBenefits,
  CouncilV2Event,
  ActiveSanction,
  SanctionLevel,
  FULL_MEMBER_BENEFITS,
  SUSPENDED_BENEFITS,
  DEFAULT_SANCTION_PENALTIES,
} from '../../types/council-v2.js';
import {
  FULL_MEMBER_BENEFITS as FULL_BENEFITS,
  SUSPENDED_BENEFITS as SUSP_BENEFITS,
  DEFAULT_SANCTION_PENALTIES as SANCTION_PENALTIES,
} from '../../types/council-v2.js';
import type { VoteChoice } from '../../types/diplomacy.js';
import type { EmpirePsychologicalState } from '../../types/psychology.js';
import type { PsychRelationship } from '../../types/diplomacy-v2.js';
import { generateId } from '../../utils/id.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CANVASSING_DURATION = 10;   // Ticks for pre-vote canvassing
const VOTING_DURATION = 15;       // Ticks for formal voting
const DEFAULT_TERM_LENGTH = 300;  // Leader term in ticks
const MAX_ACTIVE_BILLS = 3;       // Max concurrent bills
const MAX_BILL_HISTORY = 50;      // Cap on historical bills

// ---------------------------------------------------------------------------
// Council creation
// ---------------------------------------------------------------------------

/** Create a new council state. */
export function createCouncilV2(
  founderEmpires: string[],
  tick: number,
): CouncilStateV2 {
  const memberBenefits: Record<string, CouncilBenefits> = {};
  const votingPower: Record<string, number> = {};
  for (const id of founderEmpires) {
    memberBenefits[id] = { ...FULL_BENEFITS };
    votingPower[id] = 50; // Equal power at founding
  }

  return {
    formed: true,
    formedTick: tick,
    memberEmpires: [...founderEmpires],
    expelledEmpires: [],
    votingPower,
    leaderEmpireId: null,
    leaderElectedTick: 0,
    leaderTermLength: DEFAULT_TERM_LENGTH,
    activeBills: [],
    billHistory: [],
    activeSanctions: [],
    memberBenefits,
    externalReputation: {},
  };
}

// ---------------------------------------------------------------------------
// Bill lifecycle
// ---------------------------------------------------------------------------

/**
 * Propose a new bill. Only members with voting rights can propose.
 */
export function proposeBill(
  council: CouncilStateV2,
  proposerEmpireId: string,
  type: BillType,
  title: string,
  description: string,
  targetEmpireId: string | undefined,
  tick: number,
): { council: CouncilStateV2; bill: CouncilBill | null } {
  // Must be a member with voting rights
  const benefits = council.memberBenefits[proposerEmpireId];
  if (!benefits?.votingRights) return { council, bill: null };

  // Cap active bills
  if (council.activeBills.length >= MAX_ACTIVE_BILLS) return { council, bill: null };

  const bill: CouncilBill = {
    id: generateId(),
    proposerEmpireId,
    type,
    title,
    description,
    targetEmpireId,
    proposedTick: tick,
    phase: 'proposed',
    votes: {},
    vetoed: false,
    resolved: false,
    passed: false,
    canvassingResults: {},
  };

  return {
    council: { ...council, activeBills: [...council.activeBills, bill] },
    bill,
  };
}

/**
 * Advance a bill to canvassing phase.
 */
export function startCanvassing(council: CouncilStateV2, billId: string): CouncilStateV2 {
  return updateBill(council, billId, bill => ({ ...bill, phase: 'canvassing' as BillPhase }));
}

/**
 * Record a canvassing response (pre-vote indication, non-binding).
 */
export function recordCanvassingResponse(
  council: CouncilStateV2,
  billId: string,
  empireId: string,
  indication: 'likely_for' | 'likely_against' | 'undecided',
): CouncilStateV2 {
  return updateBill(council, billId, bill => ({
    ...bill,
    canvassingResults: { ...bill.canvassingResults, [empireId]: indication },
  }));
}

/**
 * Advance a bill to voting phase.
 */
export function startVoting(council: CouncilStateV2, billId: string, tick: number): CouncilStateV2 {
  return updateBill(council, billId, bill => ({
    ...bill,
    phase: 'voting' as BillPhase,
    proposedTick: tick, // Reset tick for voting window
  }));
}

/**
 * Cast a formal vote on a bill.
 */
export function castVote(
  council: CouncilStateV2,
  billId: string,
  empireId: string,
  vote: VoteChoice,
): CouncilStateV2 {
  const benefits = council.memberBenefits[empireId];
  if (!benefits?.votingRights) return council;

  return updateBill(council, billId, bill => {
    if (bill.phase !== 'voting' || bill.resolved) return bill;
    if (bill.votes[empireId] !== undefined) return bill;
    return { ...bill, votes: { ...bill.votes, [empireId]: vote } };
  });
}

/**
 * Leader vetoes a bill. Costs political capital.
 */
export function vetoBill(council: CouncilStateV2, billId: string): CouncilStateV2 {
  if (!council.leaderEmpireId) return council;

  return updateBill(council, billId, bill => ({
    ...bill,
    vetoed: true,
    resolved: true,
    passed: false,
    phase: 'resolved' as BillPhase,
  }));
}

/**
 * Resolve a bill's vote. Weighted vote tally determines outcome.
 */
export function resolveBill(
  council: CouncilStateV2,
  billId: string,
): { council: CouncilStateV2; passed: boolean; events: CouncilV2Event[] } {
  const events: CouncilV2Event[] = [];
  const bill = council.activeBills.find(b => b.id === billId);
  if (!bill || bill.resolved) return { council, passed: false, events };

  let weightFor = 0;
  let weightAgainst = 0;
  for (const [empireId, vote] of Object.entries(bill.votes)) {
    const power = council.votingPower[empireId] ?? 1;
    if (vote === 'for') weightFor += power;
    if (vote === 'against') weightAgainst += power;
  }

  const passed = weightFor > weightAgainst;

  const resolvedBill: CouncilBill = {
    ...bill,
    resolved: true,
    passed,
    phase: 'resolved',
  };

  // Move to history
  const activeBills = council.activeBills.filter(b => b.id !== billId);
  const billHistory = [...council.billHistory, resolvedBill].slice(-MAX_BILL_HISTORY);

  events.push({
    type: passed ? 'bill_passed' : 'bill_failed',
    tick: bill.proposedTick,
    description: `Council bill "${bill.title}" ${passed ? 'passed' : 'failed'} (${weightFor} for / ${weightAgainst} against).`,
    involvedEmpires: council.memberEmpires,
    billId: bill.id,
  });

  let updated = { ...council, activeBills, billHistory };

  // Apply bill effects if passed
  if (passed) {
    const effectResult = applyBillEffects(updated, resolvedBill);
    updated = effectResult.council;
    events.push(...effectResult.events);
  }

  return { council: updated, passed, events };
}

// ---------------------------------------------------------------------------
// Bill effects
// ---------------------------------------------------------------------------

function applyBillEffects(
  council: CouncilStateV2,
  bill: CouncilBill,
): { council: CouncilStateV2; events: CouncilV2Event[] } {
  const events: CouncilV2Event[] = [];
  let updated = council;

  switch (bill.type) {
    case 'condemn':
    case 'financial_penalty':
    case 'impose_sanctions':
    case 'suspend_member':
    case 'expel_member': {
      if (!bill.targetEmpireId) break;
      const level = billTypeToSanctionLevel(bill.type);
      if (!level) break;

      const sanction: ActiveSanction = {
        id: generateId(),
        targetEmpireId: bill.targetEmpireId,
        level,
        imposedTick: bill.proposedTick,
        duration: level === 'expulsion' ? -1 : (level === 'condemnation' ? 200 : 500),
        penalties: { ...SANCTION_PENALTIES[level] },
        billId: bill.id,
        reason: bill.description,
      };

      updated = {
        ...updated,
        activeSanctions: [...updated.activeSanctions, sanction],
      };

      // Apply benefit reductions
      if (level === 'suspension' || level === 'expulsion') {
        updated.memberBenefits = {
          ...updated.memberBenefits,
          [bill.targetEmpireId]: { ...SUSP_BENEFITS },
        };
      } else if (sanction.penalties.loseVotingRights) {
        const current = updated.memberBenefits[bill.targetEmpireId];
        if (current) {
          updated.memberBenefits = {
            ...updated.memberBenefits,
            [bill.targetEmpireId]: { ...current, votingRights: false, leadershipEligibility: false },
          };
        }
      }

      // Expulsion: remove from members
      if (level === 'expulsion') {
        updated = {
          ...updated,
          memberEmpires: updated.memberEmpires.filter(id => id !== bill.targetEmpireId),
          expelledEmpires: [...updated.expelledEmpires, bill.targetEmpireId],
        };
        // Remove leader if expelled
        if (updated.leaderEmpireId === bill.targetEmpireId) {
          updated.leaderEmpireId = null;
        }
        events.push({
          type: 'member_expelled',
          tick: bill.proposedTick,
          description: `${bill.targetEmpireId} has been expelled from the council.`,
          involvedEmpires: [...updated.memberEmpires, bill.targetEmpireId],
        });
      }
      break;
    }

    case 'lift_sanctions': {
      if (!bill.targetEmpireId) break;
      updated = {
        ...updated,
        activeSanctions: updated.activeSanctions.filter(s => s.targetEmpireId !== bill.targetEmpireId),
        memberBenefits: {
          ...updated.memberBenefits,
          [bill.targetEmpireId]: { ...FULL_BENEFITS },
        },
      };
      events.push({
        type: 'sanction_lifted',
        tick: bill.proposedTick,
        description: `Sanctions against ${bill.targetEmpireId} have been lifted.`,
        involvedEmpires: updated.memberEmpires,
      });
      break;
    }

    case 'admit_member': {
      if (!bill.targetEmpireId) break;
      if (updated.expelledEmpires.includes(bill.targetEmpireId)) break; // Can't re-admit expelled
      updated = {
        ...updated,
        memberEmpires: [...updated.memberEmpires, bill.targetEmpireId],
        memberBenefits: {
          ...updated.memberBenefits,
          [bill.targetEmpireId]: { ...FULL_BENEFITS },
        },
        votingPower: {
          ...updated.votingPower,
          [bill.targetEmpireId]: 30, // New members start with lower voting power
        },
      };
      events.push({
        type: 'member_admitted',
        tick: bill.proposedTick,
        description: `${bill.targetEmpireId} has been admitted to the council.`,
        involvedEmpires: updated.memberEmpires,
      });
      break;
    }

    case 'authorise_war':
    case 'declare_council_war': {
      if (!bill.targetEmpireId) break;
      events.push({
        type: 'council_war_declared',
        tick: bill.proposedTick,
        description: `The council has ${bill.type === 'declare_council_war' ? 'declared war on' : 'authorised war against'} ${bill.targetEmpireId}.`,
        involvedEmpires: [...updated.memberEmpires, bill.targetEmpireId],
      });
      break;
    }

    default:
      break;
  }

  return { council: updated, events };
}

// ---------------------------------------------------------------------------
// Psychology-driven AI voting on bills
// ---------------------------------------------------------------------------

/**
 * Determine how an AI empire would vote on a council bill.
 * Uses relationships, personality, and self-interest.
 */
export function aiVoteOnBill(
  voterState: EmpirePsychologicalState,
  bill: CouncilBill,
  voterEmpireId: string,
): VoteChoice {
  const { personality, relationships, needs } = voterState;

  // Never vote to sanction yourself
  if (bill.targetEmpireId === voterEmpireId) return 'against';

  // Self-proposed bills: always vote for
  if (bill.proposerEmpireId === voterEmpireId) return 'for';

  const proposerRel = relationships[bill.proposerEmpireId];
  const targetRel = bill.targetEmpireId ? relationships[bill.targetEmpireId] : null;

  switch (bill.type) {
    case 'condemn':
    case 'financial_penalty':
    case 'impose_sanctions':
    case 'suspend_member':
    case 'expel_member': {
      // Punitive bills: vote based on relationship with target
      if (targetRel && targetRel.warmth < -20) return 'for';       // Dislike target → punish
      if (targetRel && targetRel.warmth > 30) return 'against';    // Like target → protect
      // High moral foundations → vote for justice
      if (personality.moralFoundations.fairnessCheating > 60) return 'for';
      // Agreeable types are reluctant to punish
      if (personality.traits.agreeableness > 60) return 'abstain';
      return 'abstain';
    }

    case 'admit_member': {
      if (targetRel && targetRel.warmth > 10 && targetRel.trust > 25) return 'for';
      if (targetRel && targetRel.warmth < -10) return 'against';
      if (personality.traits.openness > 55) return 'for'; // Open to new members
      return 'abstain';
    }

    case 'authorise_war':
    case 'declare_council_war': {
      // War bills: self-interest + relationship with target
      if (targetRel && targetRel.fear > 30) return 'for';          // Fear the target → support war
      if (targetRel && targetRel.warmth > 20) return 'against';    // Like the target
      if (needs.safety < 40 && targetRel && targetRel.fear > 10) return 'for'; // Unsafe, fear target
      // Pacifist check
      if (personality.moralFoundations.careHarm > 70) return 'against';
      // Support proposer if they're an ally
      if (proposerRel && proposerRel.warmth > 40) return 'for';
      return 'abstain';
    }

    case 'lift_sanctions': {
      if (targetRel && targetRel.warmth > 20) return 'for';
      if (targetRel && targetRel.warmth < -20) return 'against';
      return 'abstain';
    }

    case 'share_resources': {
      if (bill.targetEmpireId && relationships[bill.targetEmpireId]?.warmth > 30) return 'for';
      if (personality.traits.agreeableness > 55) return 'for';
      return 'against'; // Giving away resources
    }

    default:
      return 'abstain';
  }
}

/**
 * Leader veto assessment: should the AI leader veto this bill?
 * Only vetoes if the bill directly threatens their interests or allies.
 */
export function shouldLeaderVeto(
  leaderState: EmpirePsychologicalState,
  bill: CouncilBill,
  leaderEmpireId: string,
): boolean {
  // Never veto your own bills
  if (bill.proposerEmpireId === leaderEmpireId) return false;

  // Veto sanctions against close allies
  if (bill.targetEmpireId) {
    const targetRel = leaderState.relationships[bill.targetEmpireId];
    if (targetRel && targetRel.warmth > 50 && targetRel.trust > 60) {
      // Strong ally is being sanctioned — veto to protect them
      return true;
    }
  }

  // Veto war bills if pacifist
  if ((bill.type === 'authorise_war' || bill.type === 'declare_council_war')
    && leaderState.personality.moralFoundations.careHarm > 75) {
    return true;
  }

  // Don't veto — too politically costly without strong reason
  return false;
}

/**
 * Compute the popularity cost of a veto.
 * Returns a penalty (0-50) applied to the leader's relationship with members
 * who voted for the bill.
 */
export function vetoPopularityCost(
  bill: CouncilBill,
  votingPower: Record<string, number>,
): number {
  let weightFor = 0;
  let totalWeight = 0;
  for (const [empireId, vote] of Object.entries(bill.votes)) {
    const power = votingPower[empireId] ?? 1;
    totalWeight += power;
    if (vote === 'for') weightFor += power;
  }
  if (totalWeight === 0) return 0;

  // Popularity cost scales with how much support the bill had
  const supportRatio = weightFor / totalWeight;
  return Math.round(supportRatio * 40);
}

// ---------------------------------------------------------------------------
// Per-tick council processing
// ---------------------------------------------------------------------------

/**
 * Process one council tick. Advances bill phases, resolves votes,
 * checks leader term expiry, expires sanctions.
 */
export function processCouncilTick(
  council: CouncilStateV2,
  tick: number,
  aiStates: Map<string, EmpirePsychologicalState>,
): { council: CouncilStateV2; events: CouncilV2Event[] } {
  let current = council;
  const events: CouncilV2Event[] = [];

  // 1. Advance bill phases
  for (const bill of current.activeBills) {
    if (bill.resolved) continue;

    const age = tick - bill.proposedTick;

    // Proposed → canvassing after 1 tick
    if (bill.phase === 'proposed') {
      current = startCanvassing(current, bill.id);

      // AI canvassing responses
      for (const memberId of current.memberEmpires) {
        if (memberId === bill.proposerEmpireId) continue;
        const aiState = aiStates.get(memberId);
        if (!aiState) continue;
        const wouldVote = aiVoteOnBill(aiState, bill, memberId);
        const indication = wouldVote === 'for' ? 'likely_for'
          : wouldVote === 'against' ? 'likely_against'
          : 'undecided';
        current = recordCanvassingResponse(current, bill.id, memberId, indication);
      }
    }

    // Canvassing → voting after CANVASSING_DURATION ticks
    if (bill.phase === 'canvassing' && age >= CANVASSING_DURATION) {
      current = startVoting(current, bill.id, tick);
    }

    // Voting: AI members cast votes
    if (bill.phase === 'voting') {
      for (const memberId of current.memberEmpires) {
        const updatedBill = current.activeBills.find(b => b.id === bill.id);
        if (!updatedBill || updatedBill.votes[memberId] !== undefined) continue;
        const benefits = current.memberBenefits[memberId];
        if (!benefits?.votingRights) continue;

        const aiState = aiStates.get(memberId);
        if (!aiState) continue;
        const vote = aiVoteOnBill(aiState, updatedBill, memberId);
        current = castVote(current, bill.id, memberId, vote);
      }

      // Resolve after voting window or all voted
      const updatedBill2 = current.activeBills.find(b => b.id === bill.id);
      if (updatedBill2) {
        const votingAge = tick - updatedBill2.proposedTick;
        const allVoted = current.memberEmpires
          .filter(id => current.memberBenefits[id]?.votingRights)
          .every(id => updatedBill2.votes[id] !== undefined);

        if (allVoted || votingAge >= VOTING_DURATION) {
          // Check for leader veto
          if (current.leaderEmpireId) {
            const leaderState = aiStates.get(current.leaderEmpireId);
            if (leaderState && shouldLeaderVeto(leaderState, updatedBill2, current.leaderEmpireId)) {
              current = vetoBill(current, bill.id);
              const cost = vetoPopularityCost(updatedBill2, current.votingPower);
              events.push({
                type: 'bill_vetoed',
                tick,
                description: `Council leader vetoed "${updatedBill2.title}" (popularity cost: ${cost}).`,
                involvedEmpires: current.memberEmpires,
                billId: bill.id,
              });
              continue;
            }
          }

          const result = resolveBill(current, bill.id);
          current = result.council;
          events.push(...result.events);
        }
      }
    }
  }

  // 2. Expire time-limited sanctions
  current = {
    ...current,
    activeSanctions: current.activeSanctions.filter(s => {
      if (s.duration === -1) return true; // Permanent
      return (tick - s.imposedTick) < s.duration;
    }),
  };

  // 3. Restore benefits for members whose sanctions have expired
  for (const memberId of current.memberEmpires) {
    const hasSanctions = current.activeSanctions.some(s => s.targetEmpireId === memberId);
    if (!hasSanctions && current.memberBenefits[memberId] !== FULL_BENEFITS) {
      current = {
        ...current,
        memberBenefits: {
          ...current.memberBenefits,
          [memberId]: { ...FULL_BENEFITS },
        },
      };
    }
  }

  return { council: current, events };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function updateBill(
  council: CouncilStateV2,
  billId: string,
  updater: (bill: CouncilBill) => CouncilBill,
): CouncilStateV2 {
  return {
    ...council,
    activeBills: council.activeBills.map(b => b.id === billId ? updater(b) : b),
  };
}

function billTypeToSanctionLevel(type: BillType): SanctionLevel | null {
  switch (type) {
    case 'condemn': return 'condemnation';
    case 'financial_penalty': return 'financial_penalty';
    case 'impose_sanctions': return 'sanctions';
    case 'suspend_member': return 'suspension';
    case 'expel_member': return 'expulsion';
    default: return null;
  }
}
