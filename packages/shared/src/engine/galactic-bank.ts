/**
 * Galactic Bank engine — pure functions for managing the inter-empire
 * financial institution.
 *
 * The bank is a SEPARATE institution from the Galactic Council and may
 * actively conflict with council goals:
 *  - The council wants peace; the bank profits from conflict
 *  - The bank will lend to BOTH sides of a war simultaneously
 *  - The bank enforces its own rules: defaults trigger asset freezes
 *  - The reserve currency system mirrors "joining the Euro" — painful
 *    transition but rewarding long-term stability
 *
 * All functions are side-effect free and return new state objects.
 */

import type { Empire } from '../types/species.js';
import type { GalacticBank, BankLoan } from '../types/diplomacy.js';
import type { DiplomacyState } from './diplomacy.js';
import { getRelation } from './diplomacy.js';
import { generateId } from '../utils/id.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base interest rate for new loans (per tick). */
const BASE_INTEREST_RATE = 0.02;

/** Multiplier applied to the interest rate for empires with poor reputation. */
const BAD_REPUTATION_RATE_MULTIPLIER = 2.0;

/** Reputation threshold below which the multiplier kicks in (0-1 scale). */
const BAD_REPUTATION_THRESHOLD = 0.35;

/** Reputation threshold below which loan requests are flatly rejected. */
const NOTORIOUS_REPUTATION_THRESHOLD = 0.15;

/** Starting reserves when the bank is first established. */
const INITIAL_RESERVES = 10_000;

/** Default loan duration in ticks. */
const DEFAULT_LOAN_DURATION = 50;

/** Maximum loan-to-reserves ratio the bank will permit. */
const MAX_LOAN_TO_RESERVES_RATIO = 0.3;

/** Maximum number of concurrent loans per empire. */
const MAX_LOANS_PER_EMPIRE = 3;

/**
 * Conversion allowance granted to empires joining the reserve currency.
 * Expressed as a fraction of the empire's current credits.
 */
const CONVERSION_ALLOWANCE_FRACTION = 0.1;

/** Base exchange rate for reserve currency conversion. */
const BASE_EXCHANGE_RATE = 1.0;

/** Diplomatic attitude penalty applied when an empire defaults. */
const DEFAULT_ATTITUDE_PENALTY = -30;

// ---------------------------------------------------------------------------
// Internal event type
// ---------------------------------------------------------------------------

/**
 * A bank-related event that the game loop can convert into notifications
 * or feed into the main GameEvent stream.
 */
export interface BankEvent {
  type:
    | 'bank_established'
    | 'loan_granted'
    | 'loan_rejected'
    | 'interest_collected'
    | 'loan_repaid'
    | 'loan_defaulted'
    | 'assets_frozen'
    | 'currency_joined';
  tick: number;
  description: string;
  /** Empire IDs that should be notified about this event. */
  involvedEmpires: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Deep-copy a GalacticBank so mutations do not escape.
 */
function copyBank(bank: GalacticBank): GalacticBank {
  return {
    active: bank.active,
    totalReserves: bank.totalReserves,
    interestRate: bank.interestRate,
    loans: bank.loans.map((l) => ({ ...l })),
  };
}

/**
 * Derive a reputation score (0-1) for an empire based on how other empires
 * feel about them. 0 = universally reviled, 1 = universally admired.
 */
function reputationScore(
  empireId: string,
  allEmpireIds: string[],
  diplomacyState: DiplomacyState,
): number {
  let total = 0;
  let count = 0;
  for (const otherId of allEmpireIds) {
    if (otherId === empireId) continue;
    const rel = getRelation(diplomacyState, otherId, empireId);
    if (rel && rel.firstContact >= 0) {
      total += rel.attitude; // -100..+100
      count++;
    }
  }
  if (count === 0) return 0.5;
  const average = total / count;
  return clamp((average + 100) / 200, 0, 1);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the Galactic Bank.
 *
 * The bank is created when the Galactic Council forms, but operates
 * independently from that point onward. It starts with a pool of
 * reserves and the base interest rate.
 *
 * @param tick - Game tick at which the bank is established.
 * @returns A newly initialised GalacticBank.
 */
export function initialiseBank(tick: number): GalacticBank {
  // tick is used for provenance — no stored field exists on GalacticBank
  // for the establishment tick, but callers may log it as a BankEvent.
  void tick;

  return {
    active: true,
    totalReserves: INITIAL_RESERVES,
    interestRate: BASE_INTEREST_RATE,
    loans: [],
  };
}

/**
 * Request a loan from the Galactic Bank.
 *
 * The bank evaluates creditworthiness based on reputation:
 *  - Good reputation: base interest rate
 *  - Poor reputation (below 35%): double the interest rate
 *  - Notorious (below 15%): loan flatly rejected
 *
 * The bank will lend to empires at war — it profits from conflict.
 * Both sides of a war can hold simultaneous loans.
 *
 * @param bank - Current bank state.
 * @param empireId - Empire requesting the loan.
 * @param amount - Requested loan amount.
 * @param empire - Full empire object (for credit context).
 * @param diplomacyState - Current diplomacy state (for reputation).
 * @param allEmpireIds - All empire IDs (for reputation calculation).
 * @returns Updated bank, the loan if granted, or a rejection reason.
 */
export function requestLoan(
  bank: GalacticBank,
  empireId: string,
  amount: number,
  empire: Empire,
  diplomacyState: DiplomacyState,
  allEmpireIds: string[],
): { bank: GalacticBank; loan?: BankLoan; rejected?: string } {
  if (!bank.active) {
    return { bank, rejected: 'The Galactic Bank has not been established.' };
  }

  if (amount <= 0) {
    return { bank, rejected: 'Loan amount must be positive.' };
  }

  // Check reserves — bank cannot lend more than its ratio allows.
  if (amount > bank.totalReserves * MAX_LOAN_TO_RESERVES_RATIO) {
    return {
      bank,
      rejected: `Requested amount exceeds the bank's lending capacity (max ${Math.floor(bank.totalReserves * MAX_LOAN_TO_RESERVES_RATIO)} credits).`,
    };
  }

  // Check per-empire loan limit.
  const existingLoans = bank.loans.filter(
    (l) => l.borrowerEmpireId === empireId && !l.defaulted && l.remainingBalance > 0,
  );
  if (existingLoans.length >= MAX_LOANS_PER_EMPIRE) {
    return {
      bank,
      rejected: `Empire already holds the maximum number of active loans (${MAX_LOANS_PER_EMPIRE}).`,
    };
  }

  // Reputation check.
  const reputation = reputationScore(empireId, allEmpireIds, diplomacyState);

  if (reputation < NOTORIOUS_REPUTATION_THRESHOLD) {
    return {
      bank,
      rejected:
        'Loan denied — the empire\'s diplomatic reputation is too poor for the bank to assume the risk.',
    };
  }

  // Determine interest rate.
  let rate = bank.interestRate;
  if (reputation < BAD_REPUTATION_THRESHOLD) {
    rate *= BAD_REPUTATION_RATE_MULTIPLIER;
  }

  const next = copyBank(bank);

  const loan: BankLoan = {
    id: generateId(),
    borrowerEmpireId: empireId,
    principal: amount,
    interestRate: rate,
    remainingBalance: amount,
    ticksRemaining: DEFAULT_LOAN_DURATION,
    defaulted: false,
  };

  next.loans.push(loan);
  next.totalReserves -= amount;

  return { bank: next, loan };
}

/**
 * Process one game tick for the Galactic Bank.
 *
 * Per tick:
 *  1. Collect interest on all outstanding loans (adds to remaining balance).
 *  2. Reduce ticks remaining on all loans.
 *  3. Check for loans that have expired — mark them as defaulted.
 *  4. Accrue a small amount of reserve growth (the bank earns interest income).
 *
 * @param bank - Current bank state.
 * @param tick - Current game tick.
 * @returns Updated bank and any events generated.
 */
export function processLoanTick(
  bank: GalacticBank,
  tick: number,
): { bank: GalacticBank; events: BankEvent[] } {
  if (!bank.active) return { bank, events: [] };

  const next = copyBank(bank);
  const events: BankEvent[] = [];

  for (const loan of next.loans) {
    if (loan.defaulted || loan.remainingBalance <= 0) continue;

    // 1. Accrue interest.
    const interest = loan.remainingBalance * loan.interestRate;
    loan.remainingBalance += interest;
    next.totalReserves += interest; // bank earns the interest

    // 2. Reduce time remaining.
    loan.ticksRemaining -= 1;

    // 3. Check for default (time expired with balance still outstanding).
    if (loan.ticksRemaining <= 0 && loan.remainingBalance > 0) {
      loan.defaulted = true;
      events.push({
        type: 'loan_defaulted',
        tick,
        description:
          `Empire ${loan.borrowerEmpireId} has defaulted on a loan of ${Math.round(loan.principal)} credits ` +
          `(outstanding: ${Math.round(loan.remainingBalance)} credits).`,
        involvedEmpires: [loan.borrowerEmpireId],
      });
    }
  }

  return { bank: next, events };
}

/**
 * Process a loan default — applies diplomatic consequences and may
 * trigger asset freezing by the bank.
 *
 * Defaults damage the empire's standing with all other empires and
 * result in a portion of the empire's credits being seized.
 *
 * @param bank - Current bank state.
 * @param loanId - ID of the defaulted loan.
 * @param tick - Current game tick.
 * @returns Updated bank and events describing the consequences.
 */
export function defaultOnLoan(
  bank: GalacticBank,
  loanId: string,
  tick: number,
): { bank: GalacticBank; events: BankEvent[] } {
  const events: BankEvent[] = [];
  const next = copyBank(bank);

  const loan = next.loans.find((l) => l.id === loanId);
  if (!loan) return { bank, events };

  if (!loan.defaulted) {
    loan.defaulted = true;
  }

  // The bank seizes what it can — up to the outstanding balance.
  // Actual credit deduction happens in the game loop; here we record the event.
  const seizeAmount = Math.round(loan.remainingBalance * 0.5);

  events.push({
    type: 'loan_defaulted',
    tick,
    description:
      `Default proceedings initiated against ${loan.borrowerEmpireId}. ` +
      `The Galactic Bank is seizing ${seizeAmount} credits in frozen assets.`,
    involvedEmpires: [loan.borrowerEmpireId],
  });

  events.push({
    type: 'assets_frozen',
    tick,
    description:
      `${seizeAmount} credits frozen for empire ${loan.borrowerEmpireId} as collateral for defaulted loan.`,
    involvedEmpires: [loan.borrowerEmpireId],
  });

  return { bank: next, events };
}

/**
 * Calculate the currency conversion rate for an empire joining the
 * galactic reserve currency.
 *
 * Joining the reserve currency is like "joining the Euro" — the empire
 * receives a conversion allowance but must accept the exchange rate
 * determined by its economic fundamentals relative to the bank's reserves.
 *
 * Factors:
 *  - Empire's economic output (credits * economy trait)
 *  - Bank's total reserves (larger reserves = more stable rate)
 *  - A conversion allowance of 10% of the empire's credits
 *
 * @param empireEconomy - The empire's credits and economy trait product.
 * @param bankReserves - The bank's total reserves.
 * @returns Exchange rate (credits per reserve currency unit) and the
 *          conversion allowance granted.
 */
export function calculateCurrencyConversion(
  empireEconomy: number,
  bankReserves: number,
): { exchangeRate: number; conversionAllowance: number } {
  if (bankReserves <= 0) {
    return { exchangeRate: BASE_EXCHANGE_RATE, conversionAllowance: 0 };
  }

  // Exchange rate: stronger economies get a rate closer to 1.0 (parity).
  // Weaker economies face a less favourable conversion.
  const economicRatio = empireEconomy / bankReserves;
  const exchangeRate = clamp(
    BASE_EXCHANGE_RATE * (1 + Math.log1p(economicRatio)),
    0.5,
    2.0,
  );

  // Conversion allowance: a one-time grant to ease the transition.
  const conversionAllowance = Math.round(empireEconomy * CONVERSION_ALLOWANCE_FRACTION);

  return { exchangeRate, conversionAllowance };
}

/**
 * Freeze a specified amount of an empire's assets held by the bank.
 *
 * This is the council's primary economic sanction tool, enforced via
 * the bank. The bank complies because frozen assets remain in its
 * reserves — it profits from sanctions too.
 *
 * @param bank - Current bank state.
 * @param empireId - Empire whose assets are to be frozen.
 * @param amount - Amount of credits to freeze.
 * @param tick - Current game tick.
 * @returns Updated bank and events.
 */
export function freezeAssets(
  bank: GalacticBank,
  empireId: string,
  amount: number,
  tick: number,
): { bank: GalacticBank; events: BankEvent[] } {
  if (!bank.active) return { bank, events: [] };
  if (amount <= 0) return { bank, events: [] };

  const next = copyBank(bank);
  const events: BankEvent[] = [];

  // Frozen assets go into the bank's reserves.
  next.totalReserves += amount;

  events.push({
    type: 'assets_frozen',
    tick,
    description:
      `The Galactic Bank has frozen ${amount} credits belonging to empire ${empireId} ` +
      `under council sanction authority.`,
    involvedEmpires: [empireId],
  });

  return { bank: next, events };
}

/**
 * Make a repayment on an outstanding loan.
 *
 * The repayment amount is deducted from the loan's remaining balance.
 * If the balance reaches zero, the loan is considered fully repaid.
 * Overpayment is not permitted — the amount is capped at the remaining balance.
 *
 * @param bank - Current bank state.
 * @param loanId - ID of the loan to repay.
 * @param amount - Credits being repaid.
 * @param tick - Current game tick.
 * @returns Updated bank and events.
 */
export function repayLoan(
  bank: GalacticBank,
  loanId: string,
  amount: number,
  tick: number,
): { bank: GalacticBank; events: BankEvent[] } {
  const events: BankEvent[] = [];

  if (!bank.active || amount <= 0) return { bank, events };

  const next = copyBank(bank);
  const loan = next.loans.find((l) => l.id === loanId);
  if (!loan || loan.defaulted) return { bank, events };

  const repayment = Math.min(amount, loan.remainingBalance);
  loan.remainingBalance -= repayment;
  next.totalReserves += repayment;

  if (loan.remainingBalance <= 0) {
    loan.remainingBalance = 0;
    events.push({
      type: 'loan_repaid',
      tick,
      description:
        `Empire ${loan.borrowerEmpireId} has fully repaid a loan of ${Math.round(loan.principal)} credits.`,
      involvedEmpires: [loan.borrowerEmpireId],
    });
  }

  return { bank: next, events };
}

/**
 * Create a default (inactive) bank state.
 *
 * @returns An empty GalacticBank.
 */
export function createEmptyBank(): GalacticBank {
  return {
    active: false,
    totalReserves: 0,
    interestRate: BASE_INTEREST_RATE,
    loans: [],
  };
}
