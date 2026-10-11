const test = require('node:test');
const assert = require('node:assert/strict');

const queries = [];
const cache = new Map();
const dbPath = require.resolve('../src/config/db');
require.cache[dbPath] = { exports: {
  query: async (sql, params = []) => {
    queries.push(sql);
    if (sql.startsWith('SELECT response')) {
      const value = cache.get(params[2]);
      return { rows: value ? [{ response: value }] : [] };
    }
    if (sql.startsWith('INSERT INTO ai_response_cache')) {
      cache.set(params[2], params[3]);
    }
    return { rows: [] };
  },
} };

delete process.env.GEMINI_API_KEY;
const service = require('../src/services/geminiChatService');
const { generateCached, cacheKey, inFlight, rateWindows, isQuotaError } = service._test;

test.beforeEach(() => {
  cache.clear();
  queries.length = 0;
  inFlight.clear();
  rateWindows.clear();
});

test('reuses an identical cached response without another Gemini request', async () => {
  const options = {
    userId: 7, task: 'impact', input: { total: 10 }, dataVersion: 'activities-1',
    prompt: 'prompt', fallback: 'deterministic fallback',
  };
  assert.equal(await generateCached(options), 'deterministic fallback');
  assert.equal(await generateCached(options), 'deterministic fallback');
  assert.equal(queries.filter((query) => query.startsWith('INSERT INTO ai_response_cache')).length, 1);
  assert.equal(cacheKey({ userId: 7, task: 'impact', input: { total: 10 }, dataVersion: 'activities-1' }),
    cacheKey({ userId: 7, task: 'impact', input: { total: 10 }, dataVersion: 'activities-1' }));
});

test('joins concurrent identical requests and only creates one cache record', async () => {
  const options = {
    userId: 8, task: 'coach', input: { category: 'transport' }, dataVersion: 'v1',
    prompt: 'prompt', fallback: 'fallback',
  };
  const results = await Promise.all([generateCached(options), generateCached(options)]);
  assert.deepEqual(results, ['fallback', 'fallback']);
  assert.equal(queries.filter((query) => query.startsWith('INSERT INTO ai_response_cache')).length, 1);
});

test('classifies quota responses without retry semantics', () => {
  assert.equal(isQuotaError({ status: 429 }), true);
  assert.equal(isQuotaError(new Error('resource exhausted')), true);
  assert.equal(isQuotaError(new Error('network unavailable')), false);
});
