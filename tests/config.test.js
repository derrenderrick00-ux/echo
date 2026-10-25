import test from 'node:test';
import assert from 'node:assert/strict';
import { readConfig } from '../src/core/config.js';

test('default configuration is local and uses small model', () => {
  const c = readConfig({ env: {}, root: '/tmp/echo' });
  assert.equal(c.baseUrl, 'http://127.0.0.1:11434');
  assert.equal(c.model, 'llama3.2:1b');
});

test('phase 0 refuses non-local AI endpoints', () => {
  assert.throws(() => readConfig({ env: { ECHO_OLLAMA_URL: 'https://example.com' } }), /local Ollama/);
});
