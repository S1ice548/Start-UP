/**
 * Nee-Noi Admin Backend API (zero-dependency Node server)
 * --------------------------------------------------------
 * Endpoints:
 *   GET    /api/admin/promotions            -> { ok, promotions }
 *   POST   /api/admin/promotions            -> Create/Update one promotion (upsert by id) -> { ok, promotion }
 *   DELETE /api/admin/promotions?id=<id>    -> { ok, deletedId }
 *   POST   /api/admin/promotions/analyze    -> { image_base64|image_url, mime_type } -> Gemini Vision JSON schema
 *
 * Database: JSON file at server/data/promotions.json (auto-seeded on first run).
 * Static: serves ../dist when built (single process deployment). Run: npm run server
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT || 8787);
const ROOT = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const DATA_DIR = path.join(__dirname, 'data');
// Overridable for tests (PROMOTIONS_DB_FILE) — defaults to server/data/promotions.json
const DB_FILE = process.env.PROMOTIONS_DB_FILE || path.join(DATA_DIR, 'promotions.json');
const MAX_BODY_BYTES = 15 * 1024 * 1024; // 15MB (covers base64 banner images)

/* ---------------- .env loader (no dotenv dependency) ---------------- */
function loadEnvFile() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  try {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('[TEMPLATE]')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch (err) {
    console.warn('[server] Unable to read .env file:', err.message);
  }
}
loadEnvFile();

/* ---------------- JSON-file "database" ---------------- */
// Seed data mirrors the client's INITIAL_PROMOTIONS baseline.
const PROMOTION_SEED = [
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
    promo_image_url: '',
    bank_ref_link: 'https://www.krungsri.com/th/personal/loans/home-loans/refinance',
    updated_at: 0
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
    promo_image_url: '',
    bank_ref_link: 'https://www.ghbank.co.th/product/loan',
    updated_at: 0
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
    promo_image_url: '',
    bank_ref_link: 'https://www.kasikornbank.com/th/personal/loan/homeloan/pages/refinance.aspx',
    updated_at: 0
  }
];

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(PROMOTION_SEED, null, 2), 'utf8');
      return [...PROMOTION_SEED];
    }
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [...PROMOTION_SEED];
  } catch (err) {
    console.error('[server] Failed to read promotions DB:', err.message);
    return [...PROMOTION_SEED];
  }
}

function writeDb(promotions) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmpFile = DB_FILE + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(promotions, null, 2), 'utf8');
  fs.renameSync(tmpFile, DB_FILE);
}

const PROMO_FIELDS = [
  'bank_name', 'product_name', 'min_income', 'avg_3yr_rate',
  'year_1_rate', 'year_2_3_rate', 'after_year_3_rate',
  'is_mrta', 'is_free_mortgage_fee', 'promo_image_url', 'bank_ref_link'
];

/** Normalize incoming promotion payload so the DB always stores a complete, typed record. */
function normalizePromotion(input, existingId) {
  const id = String(input.id || existingId || `promo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const normalized = {
    id,
    bank_name: String(input.bank_name || '').trim(),
    product_name: String(input.product_name || '').trim(),
    min_income: Number(input.min_income) || 0,
    avg_3yr_rate: Number(input.avg_3yr_rate) || 0,
    year_1_rate: String(input.year_1_rate || ''),
    year_2_3_rate: String(input.year_2_3_rate || ''),
    after_year_3_rate: String(input.after_year_3_rate || ''),
    is_mrta: Boolean(input.is_mrta),
    is_free_mortgage_fee: Boolean(input.is_free_mortgage_fee),
    promo_image_url: String(input.promo_image_url || ''),
    bank_ref_link: String(input.bank_ref_link || ''),
    updated_at: Date.now()
  };
  return normalized;
}

/* ---------------- Gemini Vision (server-side) ---------------- */
function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
}

const PROMO_ANALYSIS_PROMPT = `
คุณคือ AI ผู้เชี่ยวชาญด้านการวิเคราะห์โปรโมชันสินเชื่อบ้านและดอกเบี้ยรีไฟแนนซ์ (Refinance Interest Rate Banner Analyzer)
โปรดอ่านและสกัดข้อมูลจากรูปภาพแบนเนอร์โปรโมชันดอกเบี้ยนี้อย่างแม่นยำ แล้วตอบกลับเป็น JSON ภาษาไทยตามโครงสร้างนี้เท่านั้น:

{
  "bank_name": "ชื่อธนาคารเต็มภาษาไทย (เช่น ธนาคารกรุงศรีอยุธยา, ธนาคารกสิกรไทย, ธนาคารอาคารสงเคราะห์, ธนาคารไทยพาณิชย์)",
  "product_name": "ชื่อแพ็กเกจ หรือชื่อโปรโมชันสินเชื่อบ้านรีไฟแนนซ์ที่ปรากฏในรูป",
  "min_income": 15000,
  "avg_3yr_rate": 2.99,
  "year_1_rate": "อัตราดอกเบี้ยปีแรก เช่น 1.49% หรือ คงที่ 2.20%",
  "year_2_3_rate": "อัตราดอกเบี้ยปีที่ 2-3 เช่น 2.20% หรือ MRR-2.15%",
  "after_year_3_rate": "อัตราดอกเบี้ยลอยตัวหลังจากปีที่ 3 เช่น MRR-1.50%",
  "is_mrta": true,
  "is_free_mortgage_fee": true,
  "bank_ref_link": "URL เว็บไซต์ธนาคารที่ระบุในแบนเนอร์ (ถ้ามี หากไม่มีให้ระบุ null หรือ string ว่าง)"
}
หมายเหตุ: min_income และ avg_3yr_rate ต้องเป็น Number หากไม่พบข้อมูลในรูปให้ใช้ 0
`.trim();

/** Strip markdown fences / inline comments then parse the first JSON object found. */
function parseGeminiJson(text) {
  let clean = String(text || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  clean = clean.replace(/^\s*\/\/.*$/gm, '');
  const match = clean.match(/\{[\s\S]*\}/);
  const raw = match ? match[0] : clean;
  return JSON.parse(raw);
}

function normalizeAnalyzedData(parsed) {
  const str = (v) => (v && v !== 'null' ? String(v).trim() : '');
  return {
    bank_name: str(parsed.bank_name) || 'ไม่ระบุธนาคาร',
    product_name: str(parsed.product_name) || 'โปรโมชันสินเชื่อบ้านรีไฟแนนซ์',
    min_income: Number(parsed.min_income) || 0,
    avg_3yr_rate: Number(parsed.avg_3yr_rate) || 0,
    year_1_rate: str(parsed.year_1_rate),
    year_2_3_rate: str(parsed.year_2_3_rate),
    after_year_3_rate: str(parsed.after_year_3_rate),
    is_mrta: Boolean(parsed.is_mrta),
    is_free_mortgage_fee: Boolean(parsed.is_free_mortgage_fee),
    bank_ref_link: str(parsed.bank_ref_link)
  };
}

async function downloadImageAsBase64(imageUrl) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Cannot download image from URL (HTTP ${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  return { base64: buffer.toString('base64'), mime_type: contentType.split(';')[0] };
}

async function analyzeWithGeminiVision(body) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw Object.assign(new Error('GEMINI_API_KEY is not configured on the server. Set it in the .env file.'), { status: 503 });
  }

  // Accept both { image_base64 } (frontend) and { base64 } shapes
  let { image_base64: base64, image_url: imageUrl, mime_type: mimeType } = body || {};
  if (!base64 && imageUrl) {
    ({ base64, mime_type: mimeType } = await downloadImageAsBase64(imageUrl));
  }
  if (!base64) throw Object.assign(new Error('No image provided (send image_base64 or image_url)'), { status: 400 });
  // Data URL support: accept "data:image/png;base64,...."
  if (typeof base64 === 'string' && base64.startsWith('data:')) {
    const m = base64.match(/^data:([^;,]+)[^,]*,(.*)$/);
    if (!m) throw Object.assign(new Error('Invalid image data URL'), { status: 400 });
    mimeType = mimeType || m[1] || 'image/jpeg';
    base64 = m[2];
  }

  // gemini-2.0-flash was retired (Sept 2026); default to the current flash model.
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const payload = JSON.stringify({
    contents: [{
      parts: [
        { text: PROMO_ANALYSIS_PROMPT },
        { inline_data: { mime_type: mimeType || 'image/jpeg', data: base64 } }
      ]
    }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
  });

  // Retry transient Gemini failures (429 rate-limit / 5xx overloaded) with backoff.
  const TRANSIENT_STATUSES = new Set([429, 500, 502, 503]);
  let res;
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        // Vision calls can be slow, but never hang forever (90s cap)
        signal: AbortSignal.timeout(90000)
      });
      lastError = null;
      if (!TRANSIENT_STATUSES.has(res.status)) break;
    } catch (fetchErr) {
      lastError = fetchErr; // timeout / network error -> retry
    }
    if (attempt < 3) {
      const delayMs = 2000 * attempt; // 2s, 4s
      console.warn(`[server] Gemini attempt ${attempt} failed (transient) — retrying in ${delayMs}ms`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  if (lastError && !res) {
    const message = lastError.name === 'TimeoutError' || lastError.name === 'AbortError'
      ? 'Gemini Vision request timed out after 90s'
      : `Gemini Vision network error: ${lastError.message}`;
    throw Object.assign(new Error(message), { status: 504 });
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.error?.message || `Gemini API HTTP ${res.status}`;
    throw Object.assign(new Error(`Gemini Vision error: ${message}`), { status: 502 });
  }

  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('') || '';
  if (!text) throw new Error('Gemini Vision returned an empty response');
  return normalizeAnalyzedData(parseGeminiJson(text));
}

/* ---------------- HTTP plumbing ---------------- */
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, status, payload) {
  setCors(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(Object.assign(new Error('Invalid JSON body'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

/* ---------------- Static file serving (dist/) ---------------- */
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function serveStatic(req, res, urlPath) {
  const safePath = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(DIST_DIR, safePath === '/' ? 'index.html' : safePath);
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html'); // SPA fallback
  }
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('dist/ not found — run `npm run build` first, or use the Vite dev server.');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

/* ---------------- Router ---------------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const route = url.pathname;

  if (req.method === 'OPTIONS') {
    setCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    /* ---- Promotion CRUD ---- */
    if (route === '/api/admin/promotions' && req.method === 'GET') {
      const promotions = readDb()
        .slice()
        .sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
      return sendJson(res, 200, { ok: true, promotions });
    }

    if (route === '/api/admin/promotions' && req.method === 'POST') {
      const body = await readJsonBody(req);
      if (!body.bank_name || !body.bank_name.trim()) {
        return sendJson(res, 400, { ok: false, error: 'bank_name is required' });
      }
      if (!body.product_name || !body.product_name.trim()) {
        return sendJson(res, 400, { ok: false, error: 'product_name is required' });
      }

      const promotions = readDb();
      const normalized = normalizePromotion(body);
      const idx = promotions.findIndex(p => p.id === normalized.id);
      if (idx >= 0) {
        promotions[idx] = { ...promotions[idx], ...normalized }; // Update
      } else {
        promotions.unshift(normalized); // Create
      }
      writeDb(promotions);
      return sendJson(res, 200, { ok: true, promotion: normalized });
    }

    if (route === '/api/admin/promotions' && req.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return sendJson(res, 400, { ok: false, error: 'Missing ?id= parameter' });
      const promotions = readDb();
      const filtered = promotions.filter(p => p.id !== id);
      if (filtered.length === promotions.length) {
        return sendJson(res, 404, { ok: false, error: `Promotion ${id} not found` });
      }
      writeDb(filtered);
      return sendJson(res, 200, { ok: true, deletedId: id });
    }

    /* ---- Gemini Vision analyze ---- */
    if (route === '/api/admin/promotions/analyze' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const extracted = await analyzeWithGeminiVision(body);
      return sendJson(res, 200, { ok: true, promotion: extracted });
    }

    /* ---- Health check ---- */
    if (route === '/api/health') {
      const hasKey = Boolean(getGeminiApiKey());
      return sendJson(res, 200, { ok: true, service: 'nee-noi-admin-api', geminiConfigured: hasKey });
    }

    /* ---- Static SPA ---- */
    if (req.method === 'GET' && !route.startsWith('/api/')) {
      return serveStatic(req, res, route);
    }

    return sendJson(res, 404, { ok: false, error: `No route: ${req.method} ${route}` });
  } catch (err) {
    console.error(`[server] ${req.method} ${route} failed:`, err.message);
    return sendJson(res, err.status || 500, { ok: false, error: err.message });
  }
});

// Only auto-listen when executed directly (`npm run server` / `node server/index.js`).
// When imported (e.g. by tests) the module exports the server for manual control.
const isDirectRun = Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  server.listen(PORT, () => {
    console.log(`✅ Nee-Noi Admin API server running at http://localhost:${PORT}`);
    console.log(`   DB file: ${DB_FILE}`);
    console.log(`   Gemini Vision: ${getGeminiApiKey() ? 'configured ✅' : 'NOT configured (set GEMINI_API_KEY in .env) ⚠️'}`);
  });
}

export default server;
export { server, PROMOTION_SEED };
