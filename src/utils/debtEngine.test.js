import { describe, it, expect } from 'vitest';
import { calculateDebtPayoff, getFocusDebtId } from './debtEngine';
import { USER_DATA_BY_ID } from '../data/mockData';

/**
 * Regression tests: the #1 Focus Target on the payment page must always match
 * the pay method (strategy) the user chose.
 *
 * Dataset is designed so every strategy picks a DIFFERENT debt to focus:
 *   debt-a: largest balance + highest interest  -> avalanche / landslide
 *   debt-b: smallest balance + smallest minimum -> snowball / snowflake
 *   debt-c: highest minimum payment            -> tsunami
 *
 * extraBudget = 0 and interest > minimum payment for every debt, so all debts
 * stay active for the whole simulation and the ordering is deterministic.
 */
const DEBTS = [
  { id: 'debt-a', name: 'A', lender: 'L', balance: 100000, interestRate: 25, minPayment: 100 },
  { id: 'debt-b', name: 'B', lender: 'L', balance: 5000, interestRate: 10, minPayment: 20 },
  { id: 'debt-c', name: 'C', lender: 'L', balance: 40000, interestRate: 18, minPayment: 300 }
];

const FOCUS_EXPECTATIONS = {
  avalanche: 'debt-a',  // highest interest rate
  snowball: 'debt-b',   // smallest balance
  tsunami: 'debt-c',    // highest minimum payment
  snowflake: 'debt-b',  // smallest weighted balance (< 25,000 gets a heavy discount)
  landslide: 'debt-a'   // largest balance
};

describe('Focus target follows the chosen pay method', () => {
  for (const [strategy, expectedFocusId] of Object.entries(FOCUS_EXPECTATIONS)) {
    it(`${strategy} focuses ${expectedFocusId}`, () => {
      const result = calculateDebtPayoff(DEBTS, 0, strategy);
      expect(result.activeStrategyKey).toBe(strategy);
      expect(getFocusDebtId(result, DEBTS)).toBe(expectedFocusId);
    });
  }

  it('uses the user-selected strategy instead of the AI auto-selected one', () => {
    const result = calculateDebtPayoff(DEBTS, 0, 'snowball');
    expect(result.activeStrategyKey).toBe('snowball');
    // The AI pick on this dataset would be avalanche (lowest total interest),
    // so this proves the manual strategy really overrides it.
    expect(result.aiRecommendation.bestStrategyKey).toBe('avalanche');
    expect(getFocusDebtId(result, DEBTS)).toBe('debt-b');
  });

  it('without a manual strategy the focus is consistent with the AI-selected strategy', () => {
    const result = calculateDebtPayoff(DEBTS, 0, null);
    const expected = FOCUS_EXPECTATIONS[result.activeStrategyKey];
    expect(getFocusDebtId(result, DEBTS)).toBe(expected);
  });

  it('skips debts that are already closed and focuses the next priority', () => {
    const closedDebts = DEBTS.map(d => d.id === 'debt-b' ? { ...d, balance: 0 } : d);
    const result = calculateDebtPayoff(closedDebts, 0, 'snowball');
    // debt-b is closed, so the smallest remaining active balance is debt-c
    expect(getFocusDebtId(result, closedDebts)).toBe('debt-c');
  });

  it('never returns a zero-balance debt as the focus target', () => {
    for (const strategy of Object.keys(FOCUS_EXPECTATIONS)) {
      const result = calculateDebtPayoff(DEBTS, 0, strategy);
      const focusId = getFocusDebtId(result, DEBTS);
      const focusDebt = DEBTS.find(d => d.id === focusId);
      expect(focusDebt).toBeDefined();
      expect(Number(focusDebt.balance)).toBeGreaterThan(0);
    }
  });

  it('returns an empty focus id when there are no debts', () => {
    const result = calculateDebtPayoff([], 0, 'snowball');
    expect(getFocusDebtId(result, [])).toBe('');
  });
});

describe('Focus target changes with the pay method (real user1 data)', () => {
  // The exact scenario reported: with realistic balances + extra budget the
  // focus must still follow the selected strategy, not the AI default.
  const { debts: realDebts, extraBudget: realBudget } = USER_DATA_BY_ID.user1;

  // user1 debts: debt-1 (32,000 / 16%), debt-2 (85,000 / 24.5%),
  //              debt-3 (18,500 / 22%), debt-4 (240,000 / 4.8%)
  const REAL_FOCUS_EXPECTATIONS = {
    avalanche: 'debt-2', // highest interest rate
    snowball: 'debt-3',  // smallest balance
    tsunami: 'debt-4',   // highest minimum payment
    snowflake: 'debt-3', // smallest weighted balance
    landslide: 'debt-4'  // largest balance
  };

  for (const [strategy, expectedFocusId] of Object.entries(REAL_FOCUS_EXPECTATIONS)) {
    it(`${strategy} focuses ${expectedFocusId}`, () => {
      const result = calculateDebtPayoff(realDebts, realBudget, strategy);
      expect(result.activeStrategyKey).toBe(strategy);
      expect(getFocusDebtId(result, realDebts)).toBe(expectedFocusId);
    });
  }

  it('switching avalanche -> snowball changes the focus target', () => {
    const focusFor = (s) => getFocusDebtId(calculateDebtPayoff(realDebts, realBudget, s), realDebts);
    expect(focusFor('avalanche')).toBe('debt-2');
    expect(focusFor('snowball')).toBe('debt-3');
    expect(focusFor('avalanche')).not.toBe(focusFor('snowball'));
  });
});
