/** Gemini 1.5 Flash OCR Service for Debt Statement Processing */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { normalizeRateMatrix, computeAvg3yr, parseMrtaCell } from '../types/rateMatrix';

// Debt classification categories
export const DEBT_CATEGORIES = {
  CREDIT_CARD: 'CREDIT_CARD',
  HOME_LOAN: 'HOME_LOAN',
  PERSONAL_LOAN: 'PERSONAL_LOAN',
  BNPL: 'BNPL',
  COMMERCIAL_INVOICE: 'COMMERCIAL_INVOICE',
  OTHER: 'OTHER'
};

// JSON schema for extracted debt data
export const DEBT_SCHEMA = {
  type: 'object',
  properties: {
    documentType: { type: 'string', description: 'Document type (INVOICE, BANK_STATEMENT, RECEIPT)' },
    issuerName: { type: 'string', description: 'Name of the issuer or financial institution' },
    bankName: { type: 'string', description: 'Name of the financial institution (alias)' },
    debtCategory: {
      type: 'string',
      enum: Object.values(DEBT_CATEGORIES),
      description: 'Type of debt'
    },
    totalBalance: { type: 'number', description: 'Total outstanding balance' },
    minimumPayment: { type: 'number', description: 'Minimum required payment' },
    dueDate: { type: 'string', description: 'Due date for payment' },
    interestRate: { type: 'number', description: 'Annual interest rate in percentage' }
  },
  required: ['issuerName', 'debtCategory', 'totalBalance', 'minimumPayment', 'dueDate', 'interestRate']
};

// Canonical Thai bank list used by the Admin refinance promotion form
export const THAI_BANKS = [
  'ธนาคารกรุงศรีอยุธยา',
  'ธนาคารกสิกรไทย',
  'ธนาคารไทยพาณิชย์',
  'ธนาคารอาคารสงเคราะห์',
  'ธนาคารออมสิน',
  'ธนาคารทหารไทยธนชาต',
  'ธนาคารซีไอเอ็มบี ไทย',
  'ธนาคารกรุงเทพ',
  'ธนาคารกรุงไทย',
  'ธนาคารยูโอบี'
];

// Fuzzy aliases (Thai short names + English brand names) -> canonical Thai bank name
const THAI_BANK_ALIASES = [
  { canonical: 'ธนาคารกรุงศรีอยุธยา', keys: ['กรุงศรี', 'krungsri', 'krung sri', 'ayudhya'] },
  { canonical: 'ธนาคารกสิกรไทย', keys: ['กสิกร', 'kbank', 'kasikorn'] },
  { canonical: 'ธนาคารไทยพาณิชย์', keys: ['ไทยพาณิชย์', 'scb'] },
  { canonical: 'ธนาคารอาคารสงเคราะห์', keys: ['อาคารสงเคราะห์', 'ธอส', 'ghbank', 'gh bank', 'ghb'] },
  { canonical: 'ธนาคารออมสิน', keys: ['ออมสิน', 'gsb'] },
  { canonical: 'ธนาคารทหารไทยธนชาต', keys: ['ทหารไทย', 'ธนชาต', 'ttb', 'tmb'] },
  { canonical: 'ธนาคารซีไอเอ็มบี ไทย', keys: ['ซีไอเอ็มบี', 'cimb'] },
  { canonical: 'ธนาคารกรุงเทพ', keys: ['กรุงเทพ', 'bangkok bank', 'bbl'] },
  { canonical: 'ธนาคารกรุงไทย', keys: ['กรุงไทย', 'krungthai', 'krung thai', 'ktb'] },
  { canonical: 'ธนาคารยูโอบี', keys: ['ยูโอบี', 'uob'] }
];

/**
 * Normalize a bank name returned by Gemini Vision into the canonical Thai bank
 * name used across the app (falls back to the raw value when unknown).
 * @param {string} rawName
 * @returns {string}
 */
export function normalizeBankName(rawName) {
  if (!rawName || typeof rawName !== 'string') return '';
  const cleaned = rawName.trim().replace(/\s+/g, ' ');
  if (THAI_BANKS.includes(cleaned)) return cleaned;
  const lower = cleaned.toLowerCase();
  for (const entry of THAI_BANK_ALIASES) {
    if (entry.keys.some(key => lower.includes(key))) return entry.canonical;
  }
  return cleaned;
}

// Initialize Gemini AI client
const initializeGeminiClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your environment.');
  }
  return new GoogleGenerativeAI(apiKey);
};

/**
 * Extract debt information from an image using Gemini 1.5 Flash OCR
 * @param {File|Blob} imageFile - Image file or blob to process
 * @param {object} options - Processing options
 * @param {string} options.lang - Preferred language (en/th) for hint
 * @param {boolean} options.fallbackToTesseract - Whether to fall back to tesseract.js on API failure
 * @returns {Promise<DEBT_SCHEMA>} Extracted debt data
 */
export async function extractDebtDataFromImage(imageFile, options = {}) {
  const {
    lang = 'en',
    fallbackToTesseract = true,
    onProgress = () => {}
  } = options;

  try {
    // Initialize Gemini client
    const genAI = initializeGeminiClient();
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
    });

    // Convert image to base64 (supports File/Blob, data URL and http(s) URL)
    const { base64: imageAsBase64, mimeType: imageMimeType } = await resolveImageParts(imageFile);

    // Build extraction prompt
    const prompt = buildExtractionPrompt();

    // Process the image with OCR
    onProgress({ stage: 'uploading', status: 'Processing image...' });
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageAsBase64,
          mimeType: imageMimeType
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();

    onProgress({ stage: 'parsing', status: 'Parsing extracted text...' });

    // Parse the response into structured JSON
    const extractedData = parseGeminiResponse(text);

    // Validate required fields
    const validatedData = validateExtractedData(extractedData, DEBT_SCHEMA);

    onProgress({ stage: 'completed', status: 'Extraction completed successfully' });

    return validatedData;

  } catch (error) {
    console.error('Gemini OCR extraction failed:', error);

    // Fallback to tesseract.js if enabled and API fails
    if (fallbackToTesseract && error.message.includes('API key')) {
      console.warn('Falling back to Tesseract.js OCR for image processing');
      return await fallbackToTesseractOCR(imageFile, { lang, onProgress });
    }

    throw new Error(`Gemini OCR processing failed: ${error.message}`);
  }
}

/**
 * Build extraction prompt
 * @returns {string} Formatted prompt
 */
function buildExtractionPrompt() {
  const prompt = `
  คุณคือ AI สกัดข้อมูลเอกสารทางการเงินและใบแจ้งหนี้
  โปรดวิเคราะห์รูปภาพและตอบกลับเป็น JSON เท่านั้น:
  {
    "documentType": "INVOICE / BANK_STATEMENT / RECEIPT",
    "issuerName": "ชื่อผู้ออกเอกสารหรือสถาบันการเงิน (เช่น Salford & Co. หรือ KBank)",
    "debtCategory": "เลือกจาก: CREDIT_CARD, HOME_LOAN, PERSONAL_LOAN, BNPL, COMMERCIAL_INVOICE, OTHER",
    "totalBalance": 35000.00, // ยอดชำระรวม (Number)
    "minimumPayment": null,   // หากไม่มีให้ระบุ null
    "dueDate": "YYYY-MM-DD หรือ null หากไม่ระบุ",
    "interestRate": null      // หากไม่มีให้ระบุ null
  }
`;

  return prompt;
}

/**
 * Parse Gemini's response text into structured JSON
 * @param {string} responseText - Raw response from Gemini
 * @returns {DEBT_SCHEMA} Parsed data
 */
function parseGeminiResponse(responseText) {
  try {
    // Strip markdown code block wrappers if present
    let cleanText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    // Remove inline JS comments if Gemini included any in the JSON output
    cleanText = cleanText.replace(/\/\/.*/g, '');

    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return JSON.parse(cleanText.trim());
  } catch (parseError) {
    console.error('Failed to parse Gemini response:', parseError);
    throw new Error('Invalid response format from Gemini OCR service');
  }
}

/**
 * Validate extracted data against schema
 * @param {DEBT_SCHEMA} data - Extracted data
 * @param {DEBT_SCHEMA} schema - Expected schema
 * @returns {DEBT_SCHEMA} Validated and normalized data
 */
function validateExtractedData(data, schema) {
  const normalized = { ...data };

  // Normalize issuerName and bankName aliases
  if (!normalized.bankName && normalized.issuerName) {
    normalized.bankName = normalized.issuerName;
  }
  if (!normalized.issuerName && normalized.bankName) {
    normalized.issuerName = normalized.bankName;
  }

  // Set default lender and item name for UI rendering
  normalized.lender = normalized.issuerName || normalized.bankName || 'ไม่ระบุ';
  normalized.bankName = normalized.lender;
  normalized.issuerName = normalized.lender;

  if (normalized.documentType === 'INVOICE' || normalized.debtCategory === 'COMMERCIAL_INVOICE') {
    normalized.name = `ใบแจ้งหนี้ - ${normalized.lender}`;
  } else {
    normalized.name = normalized.lender;
  }

  // Normalize debt category to standard format
  if (normalized.debtCategory) {
    const categoryKey = Object.keys(DEBT_CATEGORIES).find(
      key => DEBT_CATEGORIES[key].toLowerCase() === normalized.debtCategory.toLowerCase() ||
             key.toLowerCase() === normalized.debtCategory.toLowerCase()
    );
    if (categoryKey) {
      normalized.debtCategory = DEBT_CATEGORIES[categoryKey];
    } else {
      normalized.debtCategory = DEBT_CATEGORIES.COMMERCIAL_INVOICE;
    }
  } else {
    normalized.debtCategory = DEBT_CATEGORIES.COMMERCIAL_INVOICE;
  }

  // Ensure numeric fields are numbers
  if (normalized.totalBalance !== null && normalized.totalBalance !== undefined) {
    normalized.totalBalance = Number(normalized.totalBalance);
  } else {
    normalized.totalBalance = 0;
  }

  // If minimumPayment is null/undefined for an invoice, default to totalBalance
  if (normalized.minimumPayment === null || normalized.minimumPayment === undefined) {
    normalized.minimumPayment = normalized.totalBalance;
  } else {
    normalized.minimumPayment = Number(normalized.minimumPayment);
  }

  // If interestRate is null/undefined for an invoice, default to 0%
  if (normalized.interestRate === null || normalized.interestRate === undefined) {
    normalized.interestRate = 0;
  } else {
    normalized.interestRate = Number(normalized.interestRate);
  }

  if (!normalized.dueDate || normalized.dueDate === 'null' || normalized.dueDate === 'null') {
    normalized.dueDate = 'ไม่ระบุวันครบกำหนด';
  }

  return normalized;
}

/**
 * Fallback OCR processing using Tesseract.js
 * @param {File|Blob} imageFile - Image file to process
 * @param {object} options - Processing options
 * @returns {Promise<DEBT_SCHEMA>} Extracted debt data
 */
async function fallbackToTesseractOCR(imageFile, options = {}) {
  const { lang = 'en', onProgress = () => {} } = options;

  try {
    // Import tesseract.js dynamically to avoid bundle size issues
    const { createWorker } = await import('tesseract.js');

    onProgress({ stage: 'preparing', status: 'Preparing OCR engine...' });

    // Create worker with language support
    const worker = await createWorker(lang, 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && m.progress !== undefined) {
          onProgress({
            stage: 'ocr',
            status: `OCR processing... ${Math.round(m.progress * 100)}%`
          });
        }
      }
    });

    onProgress({ stage: 'ocr', status: 'Extracting text from image...' });

    // Convert file to image source
    const imageSource = imageFile instanceof File ? imageFile : URL.createObjectURL(imageFile);

    // Perform OCR
    const { data } = await worker.recognize(imageSource);

    // Clean up worker
    await worker.terminate();

    onProgress({ stage: 'parsing', status: 'Parsing extracted text...' });

    // Parse the extracted text using the existing ocrParser utility
    const { parseOcrText } = await import('../utils/ocrParser');
    const parsedData = parseOcrText(data.text);

    onProgress({ stage: 'completed', status: 'Fallback OCR completed' });

    // Convert to expected format (this will need to be adapted based on actual output)
    return {
      bankName: '',
      debtCategory: DEBT_CATEGORIES.OTHER, // Default for fallback
      totalBalance: parsedData.data.balance ? parseFloat(parsedData.data.balance) : 0,
      minimumPayment: parsedData.data.minPayment ? parseFloat(parsedData.data.minPayment) : 0,
      dueDate: parsedData.data.dueDate || '',
      interestRate: parsedData.data.interestRate ? parseFloat(parsedData.data.interestRate) : 0
    };

  } catch (error) {
    console.error('Fallback Tesseract OCR also failed:', error);
    throw new Error(`All OCR methods failed: ${error.message}`);
  }
}

/**
 * Read a Blob/File as a base64 string via FileReader.
 * @param {Blob|File} blob
 * @returns {Promise<string>} Base64 encoded data (without data URL prefix)
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.toString().split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Resolve any supported image input into { base64, mimeType } for the Gemini API.
 * Supported inputs: File, Blob, base64 data URL string (e.g. clipboard/snipping
 * tool previews) and http(s) image URLs.
 * @param {File|Blob|string} imageFile
 * @returns {Promise<{ base64: string, mimeType: string }>}
 */
async function resolveImageParts(imageFile) {
  // Case 1: base64 data URL string (FileReader preview from the Admin upload queue)
  if (typeof imageFile === 'string' && imageFile.startsWith('data:')) {
    const match = imageFile.match(/^data:([^;,]+)[^,]*,(.*)$/);
    if (!match) {
      throw new Error('Invalid image data URL');
    }
    return { base64: match[2], mimeType: match[1] || 'image/jpeg' };
  }

  // Case 2: remote image URL — fetch it and convert to base64
  if (typeof imageFile === 'string' && /^https?:\/\//i.test(imageFile)) {
    const res = await fetch(imageFile);
    if (!res.ok) {
      throw new Error(`Cannot download image from URL (HTTP ${res.status})`);
    }
    const blob = await res.blob();
    return { base64: await blobToBase64(blob), mimeType: blob.type || 'image/jpeg' };
  }

  // Case 3: File / Blob
  if (!imageFile) {
    throw new Error('No image provided for Gemini Vision analysis');
  }
  return {
    base64: await blobToBase64(imageFile),
    mimeType: imageFile.type || 'image/jpeg'
  };
}

/**
 * Convert File/Blob to base64 for Gemini API
 * @param {File|Blob} file - File to convert
 * @returns {Promise<string>} Base64 encoded data
 */
function fileToBase64(file) {
  return blobToBase64(file);
}

/**
 * Process multiple files in batch
 * @param {File[]} files - Array of files to process
 * @param {object} options - Processing options
 * @returns {Promise<DEBT_SCHEMA[]>} Array of extracted data
 */
export async function batchExtractDebtData(files, options = {}) {
  const results = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const file = files[i];
    try {
      const data = await extractDebtDataFromImage(file, {
        ...options,
        onProgress: (progress) => {
          options.onProgress?.({
            ...progress,
            fileName: file.name,
            index: i,
            total,
            progress: ((i + progress.stage === 'completed' ? 1 : 0) + i) / total * 100
          });
        }
      });
      results.push(data);
    } catch (error) {
      console.error(`Failed to process ${file.name}:`, error);
      results.push(null);
    }
  }

  return results;
}

/**
 * Extract Refinance Interest Rate Promotion details from a banner image using Gemini Vision Model
 * @param {File|Blob} imageFile - Banner image file
 * @param {object} options - Processing options
 * @returns {Promise<object>} Extracted promotion JSON data
 */
/**
 * Normalize a raw Gemini Vision promo response into the app's promo schema.
 * @param {object} parsedData - Raw parsed JSON from Gemini (or backend)
 * @returns {object} Normalized promotion object
 */
function normalizePromoData(parsedData) {
  const str = (v) => (v && v !== 'null' ? String(v).trim() : '');
  const arr = (v) => (Array.isArray(v) ? v.map(x => String(x || '').trim()).filter(Boolean) : []);
  // Detailed condition rows (GSB/CIMB-style tables). The backend already
  // normalizes rate_matrix; this catches the client-side Gemini fallback path.
  const rateMatrix = normalizeRateMatrix(parsedData?.rate_matrix);
  return {
    bank_name: str(parsedData.bank_name) || 'ไม่ระบุธนาคาร',
    product_name: str(parsedData.product_name) || 'โปรโมชันสินเชื่อบ้านรีไฟแนนซ์',
    property_types: arr(parsedData.property_types),
    min_income: Number(parsedData.min_income) || 0,
    customer_type: str(parsedData.customer_type) || 'ทุกประเภท',
    target_loan_amount: Number(parsedData.target_loan_amount) || 0,
    min_loan_tier: Number(parsedData.min_loan_tier) || 0,
    min_loan_amount: Number(parsedData.min_loan_amount) || 0,
    max_loan_amount: Number(parsedData.max_loan_amount) || 0,
    max_ltv_percent: Number(parsedData.max_ltv_percent) || 0,
    avg_3yr_rate: Number(parsedData.avg_3yr_rate) || 0,
    year_1_rate: str(parsedData.year_1_rate),
    year_2_3_rate: str(parsedData.year_2_3_rate),
    after_year_3_rate: str(parsedData.after_year_3_rate),
    is_mrta: Boolean(parsedData.is_mrta),
    is_free_mortgage_fee: Boolean(parsedData.is_free_mortgage_fee),
    fee_waivers: arr(parsedData.fee_waivers),
    variants: Array.isArray(parsedData.variants) ? parsedData.variants : [],
    rate_matrix: rateMatrix,
    bank_ref_link: str(parsedData.bank_ref_link)
  };
}

/**
 * When the AI returned a rate_matrix but left the promo-level summary fields
 * empty, derive them from the best (lowest avg_3yr_rate) matrix row so the
 * simple form and the user-facing engine always have usable top-level rates.
 * @param {object} promo - normalized promo with a possibly-empty matrix
 * @returns {object} promo with summary fields backfilled from rate_matrix
 */
export function applyMatrixToFormFields(promo) {
  const matrix = normalizeRateMatrix(promo?.rate_matrix);
  if (matrix.length === 0) return promo;
  const best = [...matrix].sort((a, b) => (a.avg_3yr_rate || 99) - (b.avg_3yr_rate || 99))[0];
  return {
    ...promo,
    min_income: promo.min_income > 0 ? promo.min_income : (best.min_income || 0),
    avg_3yr_rate: promo.avg_3yr_rate > 0 ? promo.avg_3yr_rate : (best.avg_3yr_rate || 0),
    year_1_rate: promo.year_1_rate || best.year_1_rate || '',
    year_2_3_rate: promo.year_2_3_rate || best.year_2_3_rate || '',
    after_year_3_rate: promo.after_year_3_rate || best.after_year_3_rate || '',
    is_mrta: parseMrtaCell(promo.is_mrta, Boolean(best.is_mrta)),
    is_free_mortgage_fee: promo.fee_waivers?.length > 0
      ? promo.fee_waivers.includes('จดจำนอง')
      : (promo.is_free_mortgage_fee || Boolean(best.is_free_mortgage)),
    fee_waivers: (promo.fee_waivers?.length > 0)
      ? promo.fee_waivers
      : (best.fee_waivers || [])
  };
}

export async function extractRefinancePromoFromImage(imageFile, options = {}) {
  const { onProgress = () => {} } = options;

  // Resolve any supported input (File / Blob / data URL / http URL) into base64 parts
  const imageParts = await resolveImageParts(imageFile);

  // ---- Path 1: Backend API (server-side Gemini key, shared for every user) ----
  try {
    onProgress({ stage: 'uploading', status: 'กำลังส่งรูปภาพแบนเนอร์ไปยัง Backend API...' });
    const res = await fetch('/api/admin/promotions/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_base64: `data:${imageParts.mimeType};base64,${imageParts.base64}`
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.ok && data?.promotion) {
        onProgress({ stage: 'parsing', status: 'แปลงผลลัพธ์เป็นโครงสร้างข้อมูล...' });
        onProgress({ stage: 'completed', status: 'วิเคราะห์โปรโมชันสำเร็จ (Backend Gemini Vision)' });
        return normalizePromoData(data.promotion);
      }
      throw new Error(data?.error || 'Backend analysis failed');
    }
  } catch (backendErr) {
    console.warn('Backend Gemini Vision unavailable, falling back to client-side Gemini:', backendErr.message);
  }

  // ---- Path 2 (fallback): direct client-side Gemini call (client-only / dev mode) ----
  try {
    onProgress({ stage: 'uploading', status: 'กำลังส่งรูปภาพแบนเนอร์ให้ Gemini Vision...' });
    const genAI = initializeGeminiClient();
    // gemini-1.5-flash was retired (Sept 2026) — use the current flash model.
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
    });

    const imageAsBase64 = imageParts.base64;

    const prompt = `
  คุณคือ AI ผู้เชี่ยวชาญด้านการวิเคราะห์โปรโมชันสินเชื่อบ้านและดอกเบี้ยรีไฟแนนซ์ (Refinance Interest Rate Banner Analyzer)
  Extract the interest rate table from the provided image into a strictly structured JSON array of rows (rate_matrix). Pay close attention to column headers and merged cells that indicate conditions. For every single rate option, you MUST explicitly extract its specific conditions: Does it require MRTA? Does it offer a free mortgage fee? What is the income range? Map these into is_mrta, is_free_mortgage, min_income, and the respective interest rate periods (Year 1, Year 2-3, Avg 3 Yr).
  โปรดอ่านและสกัดข้อมูลจากรูปภาพแบนเนอร์โปรโมชันดอกเบี้ยนี้อย่างแม่นยำ แล้วตอบกลับเป็น JSON ภาษาไทยตามโครงสร้างนี้เท่านั้น:

  {
    "bank_name": "ชื่อธนาคารเต็มภาษาไทย (เช่น ธนาคารกรุงศรีอยุธยา, ธนาคารกสิกรไทย, ธนาคารอาคารสงเคราะห์, ธนาคารไทยพาณิชย์)",
    "product_name": "ชื่อแพ็กเกจ หรือชื่อโปรโมชันสินเชื่อบ้านรีไฟแนนซ์ที่ปรากฏในรูป",
    "min_income": 15000, // รายได้ขั้นต่ำต่อเดือนของ "แถวที่ดีที่สุด" (Number) หากไม่ระบุให้ใช้ 0
    "avg_3yr_rate": 2.99, // ดอกเบี้ยเฉลี่ย 3 ปีของ "แถวที่ดีที่สุด" (Number) เช่น 2.55 หรือ 2.99
    "year_1_rate": "อัตราดอกเบี้ยปีแรกของแถวที่ดีที่สุด เช่น 1.49% หรือ คงที่ 2.20%",
    "year_2_3_rate": "อัตราดอกเบี้ยปีที่ 2-3 ของแถวที่ดีที่สุด เช่น 2.20% หรือ MRR-2.15%",
    "after_year_3_rate": "อัตราดอกเบี้ยลอยตัวหลังจากปีที่ 3 เช่น MRR-1.50%",
    "is_mrta": true, // boolean (true หากมีเงื่อนไขทำประกัน MRTA / MLTA หรือ false หากไม่มี)
    "is_free_mortgage_fee": true, // boolean (true หากมีโปรโมชันฟรีค่าจดจำนอง 1% หรือ false หากไม่มี)
    "rate_matrix": [ // บังคับ: 1 แถวของตารางแบนเนอร์ = 1 object (ห้ามยุบหลายแถวเป็นแถวเดียว)
      {
        "customer_group": "พนักงานประจำ", // กลุ่มลูกค้าของแถวนี้ (ทุกประเภท หากไม่ระบุ)
        "min_income": 15000, // รายได้ขั้นต่ำของแถวนี้ (Number) — 0 หากไม่กำหนด
        "property_types": ["บ้านเดี่ยว"], // ประเภทหลักประกันเฉพาะแถวนี้ ([] หารับทุกประเภท)
        "is_mrta": true, // เซลล์ "ทำประกันชีวิต" = true, "ไม่ทำ" = false
        "is_free_mortgage": true, // เซลล์ "ฟรีค่าจดจำนอง" = true, "-"/ไม่ระบุ = false
        "fee_waivers": ["จดจำนอง"], // ประเมินราคา / จดจำนอง / อากรแสตมป์ ([] หากไม่มี)
        "year_1_rate": "1.49%", // ดอกเบี้ยปีที่ 1 ของแถวนี้
        "year_2_3_rate": "2.49%", // ดอกเบี้ยปีที่ 2-3 ของแถวนี้
        "after_year_3_rate": "MRR - 2.00%", // ดอกเบี้ยหลังปีที่ 3 (ถ้ามี)
        "avg_3yr_rate": 2.16, // เฉลี่ย 3 ปีของแถวนี้ (Number) — 0 หากไม่พบ
        "eir": 2.61 // EIR ของแถวนี้ (Number) — 0 หากไม่พบ
      }
    ],
    "bank_ref_link": "URL เว็บไซต์ธนาคารที่ระบุในแบนเนอร์ (ถ้ามี หากไม่มีให้ระบุ null หรือ string ว่าง)"
  }
`;

    onProgress({ stage: 'processing', status: 'Gemini Vision กำลังวิเคราะห์ดอกเบี้ยและเงื่อนไขโปรโมชัน...' });
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageAsBase64,
          mimeType: imageParts.mimeType
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();

    onProgress({ stage: 'parsing', status: 'แปลงผลลัพธ์เป็นโครงสร้างข้อมูล...' });

    const parsedData = parseGeminiResponse(text);

    // Normalize and validate, then backfill promo-level fields from the matrix
    const normalized = applyMatrixToFormFields(normalizePromoData(parsedData));

    onProgress({ stage: 'completed', status: 'วิเคราะห์โปรโมชันสำเร็จ' });
    return normalized;

  } catch (error) {
    console.error('Refinance Vision Extraction Failed:', error);
    throw new Error(`Gemini Vision Extraction Error: ${error.message}`);
  }
}

/**
 * Extract multiple Refinance Interest Rate Promotions in batch
 * @param {File[]|Blob[]} imageFiles - Array of banner images
 * @param {object} options - Processing options
 * @returns {Promise<Array>} Array of extracted objects
 */
export async function batchExtractRefinancePromos(imageFiles, options = {}) {
  const results = [];
  const total = imageFiles.length;

  for (let i = 0; i < total; i++) {
    const file = imageFiles[i];
    try {
      const extracted = await extractRefinancePromoFromImage(file, {
        ...options,
        onProgress: (p) => {
          options.onProgress?.({
            ...p,
            index: i,
            total,
            status: `[${i + 1}/${total}] ${p.status}`
          });
        }
      });
      results.push({ file, extracted, success: true });
    } catch (error) {
      console.error(`Batch item ${i} failed:`, error);
      results.push({ file, error: error.message, success: false });
    }
  }

  return results;
}

export default {
  extractDebtDataFromImage,
  batchExtractDebtData,
  extractRefinancePromoFromImage,
  batchExtractRefinancePromos,
  DEBT_CATEGORIES,
  DEBT_SCHEMA
};