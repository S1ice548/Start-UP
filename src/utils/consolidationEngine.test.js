import { describe, it, expect } from 'vitest';
import { calculatePMT, calculateConsolidation, formatCurrency } from './consolidationEngine';

describe('consolidationEngine', () => {
  describe('calculatePMT', () => {
    it('calculates monthly amortization correctly', () => {
      // 1,000,000 THB @ 5.5% for 20 years
      const pmt = calculatePMT(1000000, 5.5, 20);
      expect(Math.round(pmt)).toBe(6879);
    });

    it('handles 0% interest rate cleanly', () => {
      const pmt = calculatePMT(120000, 0, 10); // 120,000 over 120 months = 1000/mo
      expect(pmt).toBe(1000);
    });

    it('returns 0 for non-positive principal', () => {
      expect(calculatePMT(0, 5.5, 20)).toBe(0);
      expect(calculatePMT(-50000, 5.5, 20)).toBe(0);
    });
  });

  describe('calculateConsolidation', () => {
    const mockDebts = [
      { id: '1', name: 'KBank Credit Card', totalBalance: 50000, minimumPayment: 4000, interestRate: 16 },
      { id: '2', name: 'SCB Speedy Cash', totalBalance: 100000, minimumPayment: 8000, interestRate: 25 },
      { id: '3', name: 'Krungsri First Choice', totalBalance: 30000, minimumPayment: 2500, interestRate: 18 }
    ];

    it('calculates combined loan and monthly cashflow gain when items are selected', () => {
      const result = calculateConsolidation({
        debts: mockDebts,
        selectedDebtIds: ['1', '2'], // 150,000 total cards debt
        currentHomeLoanBalance: 1000000,
        currentHomeLoanPayment: 8000,
        targetInterestRate: 5.5,
        loanTermYears: 20
      });

      expect(result.selectedCount).toBe(2);
      expect(result.totalCardDebt).toBe(1500000 - 1350000); // 150,000
      expect(result.oldCardsMonthlyPayment).toBe(12000);
      expect(result.oldTotalMonthlyPayment).toBe(20000); // 12000 + 8000
      expect(result.newCombinedLoan).toBe(1150000); // 1,000,000 + 150,000
      expect(result.newCombinedMonthlyPayment).toBeGreaterThan(7000);
      expect(result.monthlyCashflowGain).toBeGreaterThan(0);
      expect(result.yearlyCashflowGain).toBe(result.monthlyCashflowGain * 12);
    });

    it('handles empty selection gracefully', () => {
      const result = calculateConsolidation({
        debts: mockDebts,
        selectedDebtIds: [],
        currentHomeLoanBalance: 1000000,
        currentHomeLoanPayment: 8000,
        targetInterestRate: 5.5,
        loanTermYears: 20
      });

      expect(result.selectedCount).toBe(0);
      expect(result.totalCardDebt).toBe(0);
      expect(result.oldCardsMonthlyPayment).toBe(0);
      expect(result.newCombinedLoan).toBe(1000000);
    });
  });

  describe('formatCurrency', () => {
    it('formats THB currency without decimals', () => {
      expect(formatCurrency(15000)).toContain('15,000');
    });
  });
});
