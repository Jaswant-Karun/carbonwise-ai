const test = require('node:test');
const assert = require('node:assert/strict');
const dbModulePath = require.resolve('../src/config/db');
const fakeDb = { query: null, pool: { end: async () => {} } };
require.cache[dbModulePath] = { id: dbModulePath, filename: dbModulePath, loaded: true, exports: fakeDb };
const { getScenario } = require('../src/controllers/scenarioController');

test('does not return a scenario when it belongs to another user', async () => {
  const originalQuery = fakeDb.query;
  let receivedParams;
  fakeDb.query = async (query, params) => {
    receivedParams = params;
    return { rows: [] };
  };

  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  try {
    await getScenario({ params: { id: '42' }, user: { id: 7 } }, response);
  } finally {
    fakeDb.query = originalQuery;
  }

  assert.deepEqual(receivedParams, ['42', 7]);
  assert.equal(response.statusCode, 404);
  assert.equal(response.body.message, 'Scenario not found.');
});
