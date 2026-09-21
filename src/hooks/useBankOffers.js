import { useState, useMemo, useEffect, useCallback } from 'react';
import INITIAL_OFFERS from '../data/bankOffers.json';
import INITIAL_MATRIX from '../data/refinanceRates.json';
import { fetchLiveBankRates, getBaselineBankRates } from '../utils/bankRateFetcher';

/**
 * Custom hook for managing and synchronizing dynamic bank promotional offers.
 * Connects with CORS Proxy live rate fetcher with seamless local fallback.
 */
export function useBankOffers() {
  const [offers, setOffers] = useState(() => {
    return [...INITIAL_OFFERS].sort((a, b) => Number(a.avg3YearRate) - Number(b.avg3YearRate));
  });
  const [rateMatrix, setRateMatrix] = useState(INITIAL_MATRIX);
  const [isLive, setIsLive] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState('');

  // Fetch / Sync live bank rates
  const refreshRates = useCallback(async (force = false) => {
    setIsFetching(true);
    try {
      const data = await fetchLiveBankRates(force);
      if (data.offers && data.offers.length > 0) {
        const sorted = [...data.offers].sort((a, b) => Number(a.avg3YearRate) - Number(b.avg3YearRate));
        setOffers(sorted);
      }
      if (data.rateMatrix) {
        setRateMatrix(data.rateMatrix);
      }
      setIsLive(!!data.isLive);
      setLastSyncedAt(data.fetchedAt || '');
    } catch (err) {
      const baseline = getBaselineBankRates();
      setOffers(baseline.offers);
      setRateMatrix(baseline.rateMatrix);
      setIsLive(false);
    } finally {
      setIsFetching(false);
    }
  }, []);

  // Sync on mount
  useEffect(() => {
    refreshRates(false);
  }, [refreshRates]);

  // Best overall offer (lowest interest rate)
  const bestOffer = useMemo(() => {
    if (!offers || offers.length === 0) return null;
    return offers[0];
  }, [offers]);

  // Format timestamp badge text
  const lastUpdatedBadge = useMemo(() => {
    if (isLive && lastSyncedAt) {
      return `🟢 สดจากเว็บธนาคาร (อัปเดต ${lastSyncedAt} น.)`;
    }
    const rawDate = offers[0]?.lastUpdated || new Date().toISOString().split('T')[0];
    try {
      const [year, month, day] = rawDate.split('-');
      const monthNamesTH = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
      ];
      const mIdx = parseInt(month, 10) - 1;
      const thMonth = monthNamesTH[mIdx] || 'ส.ค.';
      return `🟡 ใช้อัตราออฟไลน์สำรอง (${parseInt(day, 10)} ${thMonth} ${year})`;
    } catch (e) {
      return `🟡 ใช้อัตราออฟไลน์สำรอง (${rawDate})`;
    }
  }, [offers, isLive, lastSyncedAt]);

  // Get offers filtered by income eligibility
  const getEligibleOffers = useCallback((monthlyIncome = 0) => {
    const income = Number(monthlyIncome) || 0;
    return offers
      .filter(offer => income >= Number(offer.minIncome || 0))
      .sort((a, b) => Number(a.avg3YearRate) - Number(b.avg3YearRate));
  }, [offers]);

  // Lowest target interest rate for Debt Consolidation
  const lowestRate = useMemo(() => {
    return bestOffer ? Number(bestOffer.avg3YearRate) : 3.25;
  }, [bestOffer]);

  return {
    offers,
    rateMatrix,
    bestOffer,
    lowestRate,
    lastUpdatedBadge,
    isLive,
    isFetching,
    lastSyncedAt,
    refreshRates,
    getEligibleOffers,
    setOffers
  };
}

export default useBankOffers;
