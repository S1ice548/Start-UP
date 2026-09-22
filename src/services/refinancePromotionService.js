/**
 * Service for managing bank refinance promotions state
 * Supports LocalStorage persistence and API synchronization.
 */

const STORAGE_KEY = 'nee_noi_admin_refinance_promotions';

// Default initial promotions seeded from baseline data
export const INITIAL_PROMOTIONS = [
  {
    id: 'promo-krungsri-opt1',
    bank_name: 'ธนาคารกรุงศรีอยุธยา',
    product_name: 'กรุงศรี รีไฟแนนซ์ ทางเลือก 1',
    min_income: 15000,
    avg_3yr_rate: 2.55,
    year_1_rate: '2.20%',
    year_2_3_rate: '2.20%',
    after_year_3_rate: 'MRR - 2.15%',
    is_mrta: true,
    is_free_mortgage_fee: false,
    promo_image_url: 'https://www.krungsri.com/Krungsri2018/media/Personal/Loans/Home-Loan/refinance-banner.jpg',
    bank_ref_link: 'https://www.krungsri.com/th/personal/loans/home-loans/refinance',
    updated_at: Date.now()
  },
  {
    id: 'promo-ghbank-1',
    bank_name: 'ธนาคารอาคารสงเคราะห์',
    product_name: 'โครงการสินเชื่อบ้านสุขสันต์ (Refinance In)',
    min_income: 15000,
    avg_3yr_rate: 2.99,
    year_1_rate: '1.99%',
    year_2_3_rate: '3.49%',
    after_year_3_rate: 'MRR - 1.50%',
    is_mrta: true,
    is_free_mortgage_fee: true,
    promo_image_url: 'https://www.ghbank.co.th/uploads/banner/refinance-home.jpg',
    bank_ref_link: 'https://www.ghbank.co.th/product/loan',
    updated_at: Date.now()
  },
  {
    id: 'promo-kbank-1',
    bank_name: 'ธนาคารกสิกรไทย',
    product_name: 'K-Home Loan รีไฟแนนซ์ ปลดภาระหนี้บ้าน',
    min_income: 30000,
    avg_3yr_rate: 2.99,
    year_1_rate: '2.50%',
    year_2_3_rate: '3.23%',
    after_year_3_rate: 'MRR - 1.80%',
    is_mrta: false,
    is_free_mortgage_fee: false,
    promo_image_url: 'https://www.kasikornbank.com/th/personal/loan/homeloan/publishingimages/refinance-banner.jpg',
    bank_ref_link: 'https://www.kasikornbank.com/th/personal/loan/homeloan/pages/refinance.aspx',
    updated_at: Date.now()
  }
];

/**
 * Get all promotions
 * @returns {Promise<Array>} List of promotions
 */
export async function getPromotions() {
  try {
    // Try fetching from API endpoint if available.
    // NOTE: trust the API whenever the response is OK, even if the list is
    // empty (admin may have deleted every promotion) — only fall back to the
    // stale localStorage copy when the backend is unreachable.
    const response = await fetch('/api/admin/promotions');
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.promotions)) {
        return data.promotions;
      }
    }
  } catch (e) {
    // API not reachable or running in client-only mode
  }

  // Fallback to LocalStorage
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved promotions:', e);
    }
  }

  // Seed default data
  localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_PROMOTIONS));
  return INITIAL_PROMOTIONS;
}

/**
 * Save or Update a promotion
 * @param {Object} promo - Promotion object
 * @returns {Promise<Object>} Saved promotion
 */
export async function savePromotion(promo) {
  const isEdit = Boolean(promo.id);
  const updatedPromo = {
    ...promo,
    id: promo.id || `promo-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    min_income: Number(promo.min_income) || 0,
    avg_3yr_rate: Number(promo.avg_3yr_rate) || 0,
    is_mrta: Boolean(promo.is_mrta),
    is_free_mortgage_fee: Boolean(promo.is_free_mortgage_fee),
    updated_at: Date.now()
  };

  // Try API backend
  try {
    const response = await fetch('/api/admin/promotions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedPromo)
    });
    if (response.ok) {
      const resData = await response.json();
      if (resData.promotion) {
        return resData.promotion;
      }
    }
  } catch (e) {
    // Fallback to local storage
  }

  // Local storage save (guarded — large base64 banner images can exceed the quota)
  try {
    const current = await getPromotions();
    let updatedList;
    if (isEdit) {
      updatedList = current.map(p => p.id === updatedPromo.id ? updatedPromo : p);
    } else {
      updatedList = [updatedPromo, ...current];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
  } catch (e) {
    console.warn('Failed to persist promotions to localStorage (quota?):', e);
  }

  return updatedPromo;
}

/**
 * Delete a promotion by ID
 * @param {string} id - Promotion ID
 * @returns {Promise<boolean>} Success indicator
 */
export async function deletePromotion(id) {
  try {
    const response = await fetch(`/api/admin/promotions?id=${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (response.ok) {
      return true;
    }
  } catch (e) {
    // Fallback to local storage
  }

  try {
    const current = await getPromotions();
    const updatedList = current.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
  } catch (e) {
    console.warn('Failed to update localStorage promotions after delete:', e);
  }
  return true;
}

export default {
  getPromotions,
  savePromotion,
  deletePromotion,
  INITIAL_PROMOTIONS
};
