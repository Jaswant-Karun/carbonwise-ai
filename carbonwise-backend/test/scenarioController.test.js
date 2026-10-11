const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/db');
const { getScenario } = require('../src/controllers/scenarioController');

test('does not return a scenario when it belongs to another user', async () => {
  const originalQuery = db.query;
  let receivedParams;
  db.query = async (query, params) => {
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
    db.query = originalQuery;
  }

  assert.deepEqual(receivedParams, ['42', 7]);
  assert.equal(response.statusCode, 404);
  assert.equal(response.body.message, 'Scenario not found.');
});
