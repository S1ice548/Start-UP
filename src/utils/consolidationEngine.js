/**
 * Debt Consolidation Calculation Utility
 *
 * Math Engine for combining high-interest credit card / personal loan debts
 * into a low-interest Home Loan Top-Up mortgage.
 */

/**
 * Calculate PMT (Monthly Amortization Installment)
 * M = P * r / (1 - (1 + r)^-n)
 */
export function calculatePMT(principal, annualInterestRatePct, termYears = 20) {
  const P = Math.max(0, Number(principal) || 0);
  const annualRate = Math.max(0, Number(annualInterestRatePct) || 0);
  const years = Math.max(1, Number(termYears) || 20);
  const n = years * 12;
  const r = annualRate / 100 / 12;

  if (P <= 0) return 0;
  if (r <= 0) return P / n;

  return (P * r) / (1 - Math.pow(1 + r, -n));
}

/**
 * Main consolidation math function
 *
 * @param {object} params
 * @param {Array} params.debts - Full list of user's uploaded debts
 * @param {Array|Set} params.selectedDebtIds - IDs of debts selected for consolidation
 * @param {number} params.currentHomeLoanBalance - Existing home loan principal
 * @param {number} params.currentHomeLoanPayment - Existing home loan monthly payment
 * @param {number} params.targetInterestRate - New top-up annual interest rate % (default: 5.5%)
 * @param {number} params.loanTermYears - Loan duration in years (default: 20 years)
 */
export function calculateConsolidation({
  debts = [],
  selectedDebtIds = [],
  currentHomeLoanBalance = 1500000,
  currentHomeLoanPayment = 9500,
  targetInterestRate = 5.5,
  loanTermYears = 20
}) {
  const selectedSet = new Set(selectedDebtIds || []);
  
  // Filter debts that are selected by user
  const selectedDebts = (debts || []).filter(d => selectedSet.has(d.id));

  // 1. Calculate Total Card Debt & Current Card Monthly Payments
  let totalCardDebt = 0;
  let oldCardsMonthlyPayment = 0;
  let totalWeightedRateNumerator = 0;

  selectedDebts.forEach(debt => {
    const balance = Number(debt.totalBalance ?? debt.balance ?? 0);
    const minPay = Number(debt.minimumPayment ?? debt.minPayment ?? (balance * 0.05));
    const rate = Number(debt.interestRate ?? debt.rate ?? 18);

    totalCardDebt += balance;
    oldCardsMonthlyPayment += minPay;
    totalWeightedRateNumerator += (balance * rate);
  });

  const homeBalance = Math.max(0, Number(currentHomeLoanBalance) || 0);
  const homePayment = Math.max(0, Number(currentHomeLoanPayment) || 0);

  // 2. Old Total Monthly Payment (Cards + Home Loan)
  const oldTotalMonthlyPayment = oldCardsMonthlyPayment + homePayment;

  // 3. New Combined Loan Principal (Home Loan Balance + Consolidated Card Debt)
  const newCombinedLoan = homeBalance + totalCardDebt;

  // 4. New Combined Monthly Installment using PMT formula
  const rawNewPayment = calculatePMT(
    newCombinedLoan,
    targetInterestRate,
    loanTermYears
  );
  const newCombinedMonthlyPayment = Math.round(rawNewPayment);

  // 5. Monthly Cashflow Gain & Yearly Cashflow Gain
  const monthlyCashflowGain = Math.round(oldTotalMonthlyPayment - newCombinedMonthlyPayment);
  const yearlyCashflowGain = monthlyCashflowGain * 12;

  // Weighted average interest rate of selected credit cards
  const averageCardRate = totalCardDebt > 0
    ? totalWeightedRateNumerator / totalCardDebt
    : 0;

  // Interest rate savings delta
  const rateReduction = Math.max(0, averageCardRate - targetInterestRate);

  return {
    selectedCount: selectedDebts.length,
    selectedDebts,
    totalCardDebt,
    oldCardsMonthlyPayment,
    currentHomeLoanBalance: homeBalance,
    currentHomeLoanPayment: homePayment,
    oldTotalMonthlyPayment,
    newCombinedLoan,
    newCombinedMonthlyPayment,
    monthlyCashflowGain,
    yearlyCashflowGain,
    averageCardRate: Math.round(averageCardRate * 10) / 10,
    rateReduction: Math.round(rateReduction * 10) / 10,
    targetInterestRate,
    loanTermYears
  };
}

/** Utility to format Thai Baht currency strings cleanly */
export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0
  }).format(num);
}
