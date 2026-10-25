import test from 'node:test';
import assert from 'node:assert/strict';
import { OllamaEmbeddings } from '../src/providers/embeddings.js';

test('embeddings use local /api/embed with all-minilm', async () => {
  let sent;
  const p = new OllamaEmbeddings({ fetchImpl: async (url, request) => {
    sent = { url, request };
    return { ok: true, json: async () => ({ embeddings: [[0.2, 0.4]] }) };
  }});
  assert.deepEqual(await p.embed('Remember networking'), [0.2, 0.4]);
  assert.equal(sent.url, 'http://127.0.0.1:11434/api/embed');
  assert.equal(JSON.parse(sent.request.body).model, 'all-minilm');
});

test('missing embeddings model reports pull command', async () => {
  const p = new OllamaEmbeddings({ fetchImpl: async () => ({ ok: false, status: 404 }) });
  await assert.rejects(p.embed('hi'), /ollama pull all-minilm/);
});
