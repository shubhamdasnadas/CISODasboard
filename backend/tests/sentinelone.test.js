const test = require('node:test');
const assert = require('node:assert/strict');
const { isOptionalS1EndpointFailure } = require('../services/sentinelone');

test('treats 404 Not Found as optional for unsupported SentinelOne endpoints', () => {
  assert.equal(
    isOptionalS1EndpointFailure(404, '<!doctype html><title>404 Not Found</title><h1>Not Found</h1>'),
    true
  );
});

test('does not treat authentication or server errors as optional', () => {
  assert.equal(isOptionalS1EndpointFailure(401, 'Unauthorized'), false);
  assert.equal(isOptionalS1EndpointFailure(500, 'Internal Server Error'), false);
});
