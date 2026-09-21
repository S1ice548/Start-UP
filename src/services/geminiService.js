/** Gemini 1.5 Flash OCR Service for Debt Statement Processing */

import { GoogleGenerativeAI } from '@google/generative-ai';

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
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Convert image to base64
    const imageAsBase64 = await fileToBase64(imageFile);

    // Build extraction prompt
    const prompt = buildExtractionPrompt();

    // Process the image with OCR
    onProgress({ stage: 'uploading', status: 'Processing image...' });
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageAsBase64,
          mimeType: imageFile.type || 'image/jpeg'
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
 * Convert File/Blob to base64 for Gemini API
 * @param {File|Blob} file - File to convert
 * @returns {Promise<string>} Base64 encoded data
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.toString().split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
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
export async function extractRefinancePromoFromImage(imageFile, options = {}) {
  const { onProgress = () => {} } = options;

  try {
    onProgress({ stage: 'uploading', status: 'กำลังส่งรูปภาพแบนเนอร์ให้ Gemini Vision...' });
    const genAI = initializeGeminiClient();
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const imageAsBase64 = await fileToBase64(imageFile);

    const prompt = `
  คุณคือ AI ผู้เชี่ยวชาญด้านการวิเคราะห์โปรโมชันสินเชื่อบ้านและดอกเบี้ยรีไฟแนนซ์ (Refinance Interest Rate Banner Analyzer)
  โปรดอ่านและสกัดข้อมูลจากรูปภาพแบนเนอร์โปรโมชันดอกเบี้ยนี้อย่างแม่นยำ แล้วตอบกลับเป็น JSON ภาษาไทยตามโครงสร้างนี้เท่านั้น:

  {
    "bank_name": "ชื่อธนาคารเต็มภาษาไทย (เช่น ธนาคารกรุงศรีอยุธยา, ธนาคารกสิกรไทย, ธนาคารอาคารสงเคราะห์, ธนาคารไทยพาณิชย์)",
    "product_name": "ชื่อแพ็กเกจ หรือชื่อโปรโมชันสินเชื่อบ้านรีไฟแนนซ์ที่ปรากฏในรูป",
    "min_income": 15000, // รายได้ขั้นต่ำต่อเดือนที่สมัครได้เป็นตัวเลข (Number) หากไม่ระบุให้ใช้ 0
    "avg_3yr_rate": 2.99, // อัตราดอกเบี้ยเฉลี่ย 3 ปีแรกเป็นตัวเลขเปอร์เซ็นต์ float (Number) เช่น 2.55 หรือ 2.99
    "year_1_rate": "อัตราดอกเบี้ยปีแรก เช่น 1.49% หรือ คงที่ 2.20%",
    "year_2_3_rate": "อัตราดอกเบี้ยปีที่ 2-3 เช่น 2.20% หรือ MRR-2.15%",
    "after_year_3_rate": "อัตราดอกเบี้ยลอยตัวหลังจากปีที่ 3 เช่น MRR-1.50%",
    "is_mrta": true, // boolean (true หากมีเงื่อนไขทำประกัน MRTA / MLTA หรือ false หากไม่มี)
    "is_free_mortgage_fee": true, // boolean (true หากมีโปรโมชันฟรีค่าจดจำนอง 1% หรือ false หากไม่มี)
    "bank_ref_link": "URL เว็บไซต์ธนาคารที่ระบุในแบนเนอร์ (ถ้ามี หากไม่มีให้ระบุ null หรือ string ว่าง)"
  }
`;

    onProgress({ stage: 'processing', status: 'Gemini Vision กำลังวิเคราะห์ดอกเบี้ยและเงื่อนไขโปรโมชัน...' });
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageAsBase64,
          mimeType: imageFile.type || 'image/jpeg'
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();

    onProgress({ stage: 'parsing', status: 'แปลงผลลัพธ์เป็นโครงสร้างข้อมูล...' });

    const parsedData = parseGeminiResponse(text);

    // Normalize and validate
    const normalized = {
      bank_name: parsedData.bank_name || 'ไม่ระบุธนาคาร',
      product_name: parsedData.product_name || 'โปรโมชันสินเชื่อบ้านรีไฟแนนซ์',
      min_income: Number(parsedData.min_income) || 0,
      avg_3yr_rate: Number(parsedData.avg_3yr_rate) || 0,
      year_1_rate: parsedData.year_1_rate || '',
      year_2_3_rate: parsedData.year_2_3_rate || '',
      after_year_3_rate: parsedData.after_year_3_rate || '',
      is_mrta: Boolean(parsedData.is_mrta),
      is_free_mortgage_fee: Boolean(parsedData.is_free_mortgage_fee),
      bank_ref_link: parsedData.bank_ref_link && parsedData.bank_ref_link !== 'null' ? parsedData.bank_ref_link : ''
    };

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