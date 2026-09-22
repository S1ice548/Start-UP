/**
 * Backend API integration tests (server/index.js)
 * Imports the real server module, listens on an ephemeral port with a temp
 * JSON DB, and exercises the full HTTP request/response cycle with fetch().
 * The Gemini API call is stubbed at the global fetch level so the analyze
 * pipeline is tested end-to-end without any network access.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Test-isolated DB + deterministic Gemini key BEFORE importing the server
const TEST_DB_FILE = path.join(os.tmpdir(), `nee-noi-promotions-test-${process.pid}.json`);
process.env.PROMOTIONS_DB_FILE = TEST_DB_FILE;
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key-for-vitest';

const { default: server, PROMOTION_SEED } = await import('./index.js');

let baseUrl = '';

beforeAll(async () => {
  await new Promise((resolve) => {
    server.listen(0, () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  // Drop keep-alive sockets so vitest can exit cleanly
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
  try { fs.unlinkSync(TEST_DB_FILE); } catch { /* ignore */ }
});

describe('GET /api/health', () => {
  it('returns ok with geminiConfigured flag', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.geminiConfigured).toBe(true);
  });
});

describe('Promotion CRUD', () => {
  it('GET seeds and returns the baseline promotions on a fresh DB', async () => {
    const res = await fetch(`${baseUrl}/api/admin/promotions`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.promotions.length).toBe(PROMOTION_SEED.length);
    // sorted newest first
    for (let i = 1; i < data.promotions.length; i++) {
      expect(data.promotions[i].updated_at).toBeLessThanOrEqual(data.promotions[i - 1].updated_at);
    }
  });

  it('POST creates a promotion with normalized fields', async () => {
    const res = await fetch(`${baseUrl}/api/admin/promotions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bank_name: 'ธนาคารกรุงไทย',
        product_name: 'Test Refi',
        min_income: '12000',       // string -> coerced to Number
        avg_3yr_rate: 2.45,
        is_mrta: 1,                // truthy -> Boolean true
        is_free_mortgage_fee: true
      })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.promotion.id).toMatch(/^promo-/);
    expect(data.promotion.min_income).toBe(12000);
    expect(data.promotion.is_mrta).toBe(true);
    expect(typeof data.promotion.updated_at).toBe('number');

    const list = (await (await fetch(`${baseUrl}/api/admin/promotions`)).json()).promotions;
    expect(list.find(p => p.id === data.promotion.id)?.product_name).toBe('Test Refi');
  });

  it('POST with the same id updates in place (no duplicate)', async () => {
    const created = (await (
      await fetch(`${baseUrl}/api/admin/promotions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bank_name: 'ธนาคารกรุงไทย', product_name: 'Upsert v1', avg_3yr_rate: 2.5 })
      })
    ).json()).promotion;

    const updated = (await (
      await fetch(`${baseUrl}/api/admin/promotions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: created.id, bank_name: 'ธนาคารกรุงไทย', product_name: 'Upsert v2', avg_3yr_rate: 1.99 })
      })
    ).json()).promotion;

    expect(updated.id).toBe(created.id);
    expect(updated.product_name).toBe('Upsert v2');
    expect(updated.avg_3yr_rate).toBe(1.99);
    expect(updated.updated_at).toBeGreaterThanOrEqual(created.updated_at);

    const list = (await (await fetch(`${baseUrl}/api/admin/promotions`)).json()).promotions;
    expect(list.filter(p => p.id === created.id).length).toBe(1);
  });

  it('POST rejects missing bank_name / product_name with 400', async () => {
    const noBank = await fetch(`${baseUrl}/api/admin/promotions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_name: 'x' })
    });
    expect(noBank.status).toBe(400);

    const noProduct = await fetch(`${baseUrl}/api/admin/promotions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bank_name: 'x' })
    });
    expect(noProduct.status).toBe(400);
    expect((await noProduct.json()).error).toMatch(/product_name/);
  });

  it('POST with malformed JSON body returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/admin/promotions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not-json'
    });
    expect(res.status).toBe(400);
  });

  it('DELETE removes a promotion; unknown id returns 404', async () => {
    const created = (await (
      await fetch(`${baseUrl}/api/admin/promotions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bank_name: 'ธนาคารออมสิน', product_name: 'To be deleted' })
      })
    ).json()).promotion;

    const del = await fetch(`${baseUrl}/api/admin/promotions?id=${encodeURIComponent(created.id)}`, { method: 'DELETE' });
    expect(del.status).toBe(200);
    expect((await del.json()).deletedId).toBe(created.id);

    const missing = await fetch(`${baseUrl}/api/admin/promotions?id=${encodeURIComponent(created.id)}`, { method: 'DELETE' });
    expect(missing.status).toBe(404);

    const noId = await fetch(`${baseUrl}/api/admin/promotions`, { method: 'DELETE' });
    expect(noId.status).toBe(400);
  });
});

describe('POST /api/admin/promotions/analyze', () => {
  it('rejects requests without an image (400)', async () => {
    const res = await fetch(`${baseUrl}/api/admin/promotions/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/No image provided/);
  });

  it('rejects malformed data URLs (400)', async () => {
    const res = await fetch(`${baseUrl}/api/admin/promotions/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: 'data:broken' })
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Invalid image data URL/);
  });

  it('parses a data URL, calls Gemini Vision, and returns the normalized promo JSON', async () => {
    // Stub the Gemini REST call at the network boundary
    const geminiJson = JSON.stringify({
      bank_name: 'ธนาคารกรุงไทย',
      product_name: 'รีไฟแนนซ์ KTB AI',
      min_income: '12000',
      avg_3yr_rate: '2.45',
      year_1_rate: '1.49%',
      year_2_3_rate: null,
      after_year_3_rate: 'MRR-1.50%',
      is_mrta: false,
      is_free_mortgage_fee: 'true',
      bank_ref_link: 'null'
    });
    let capturedRequest = null;
    const origFetch = globalThis.fetch; // capture BEFORE spying
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      if (String(url).includes('generativelanguage.googleapis.com')) {
        capturedRequest = { url: String(url), init };
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: geminiJson }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      // passthrough for local API calls
      return origFetch(url, init);
    });

    try {
      const res = await fetch(`${baseUrl}/api/admin/promotions/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        })
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);

      // Normalization of Gemini output
      expect(data.promotion.bank_name).toBe('ธนาคารกรุงไทย');
      expect(data.promotion.min_income).toBe(12000);   // string -> Number
      expect(data.promotion.avg_3yr_rate).toBe(2.45);  // string -> Number
      expect(data.promotion.is_free_mortgage_fee).toBe(true); // 'true' -> Boolean
      expect(data.promotion.year_2_3_rate).toBe('');   // null -> ''
      expect(data.promotion.bank_ref_link).toBe('');   // 'null' -> ''

      // Gemini request shape: key in URL + inline_data image part
      expect(capturedRequest).toBeTruthy();
      expect(capturedRequest.url).toContain('models/gemini');
      expect(capturedRequest.url).toContain('key=');
      const sentBody = JSON.parse(capturedRequest.init.body);
      const parts = sentBody.contents[0].parts;
      expect(parts[0].text).toContain('bank_name');
      expect(parts[1].inline_data.mime_type).toBe('image/png');
      expect(parts[1].inline_data.data).not.toContain('data:'); // raw base64 only
    } finally {
      fetchSpy.mockRestore();
      delete fetch.__orig;
    }
  });

  it('returns 502 when Gemini responds with an API error', async () => {
    const origFetch = globalThis.fetch; // capture BEFORE spying
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      if (String(url).includes('generativelanguage.googleapis.com')) {
        return new Response(JSON.stringify({ error: { message: 'API key invalid' } }), { status: 400 });
      }
      return origFetch(url, init); // forward full init (POST method/body)
    });

    try {
      const res = await fetch(`${baseUrl}/api/admin/promotions/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: 'aGVsbG8=' })
      });
      expect(res.status).toBe(502);
      expect((await res.json()).error).toMatch(/Gemini Vision error/);
    } finally {
      fetchSpy.mockRestore();
      delete fetch.__orig;
    }
  });
});
