import { useState, useMemo } from 'react';
import INITIAL_OFFERS from '../data/bankOffers.json';

/**
 * Custom hook for managing and synchronizing dynamic bank promotional offers.
 */
export function useBankOffers() {
  const [offers, setOffers] = useState(() => {
    // Return offers sorted by lowest 3-year rate by default
    return [...INITIAL_OFFERS].sort((a, b) => Number(a.avg3YearRate) - Number(b.avg3YearRate));
  });

  // Best overall offer (lowest interest rate)
  const bestOffer = useMemo(() => {
    if (!offers || offers.length === 0) return null;
    return offers[0];
  }, [offers]);

  // Format timestamp badge text (e.g., "อัปเดตดอกเบี้ยล่าสุด: 21 ส.ค. 2026")
  const lastUpdatedBadge = useMemo(() => {
    const rawDate = offers[0]?.lastUpdated || new Date().toISOString().split('T')[0];
    try {
      const [year, month, day] = rawDate.split('-');
      const monthNamesTH = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
      ];
      const mIdx = parseInt(month, 10) - 1;
      const thMonth = monthNamesTH[mIdx] || 'ส.ค.';
      return `อัปเดตดอกเบี้ยล่าสุด: ${parseInt(day, 10)} ${thMonth} ${year}`;
    } catch (e) {
      return `อัปเดตดอกเบี้ยล่าสุด: ${rawDate}`;
    }
  }, [offers]);

  // Get offers filtered by income eligibility and sorted by lowest rate
  const getEligibleOffers = (monthlyIncome = 0) => {
    const income = Number(monthlyIncome) || 0;
    return offers
      .filter(offer => income >= Number(offer.minIncome || 0))
      .sort((a, b) => Number(a.avg3YearRate) - Number(b.avg3YearRate));
  };

  // Lowest target interest rate for Debt Consolidation
  const lowestRate = useMemo(() => {
    return bestOffer ? Number(bestOffer.avg3YearRate) : 3.5;
  }, [bestOffer]);

  return {
    offers,
    bestOffer,
    lowestRate,
    lastUpdatedBadge,
    getEligibleOffers,
    setOffers
  };
}

export default useBankOffers;
