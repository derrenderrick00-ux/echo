import test from 'node:test';
import assert from 'node:assert/strict';
import { OllamaProvider } from '../src/providers/ollama.js';

test('provider sends chat request to local Ollama', async () => {
  let captured;
  const provider = new OllamaProvider({ model: 'llama3.2:1b', fetchImpl: async (url, options) => {
    captured = { url, options };
    return { ok: true, json: async () => ({ message: { content: 'Hello from Echo' } }) };
  }});
  const text = await provider.chat([{ role: 'user', content: 'Hi' }]);
  assert.equal(text, 'Hello from Echo');
  assert.equal(captured.url, 'http://127.0.0.1:11434/api/chat');
  assert.equal(JSON.parse(captured.options.body).stream, false);
  assert.equal(JSON.parse(captured.options.body).model, 'llama3.2:1b');
});

test('missing model reports how to pull it', async () => {
  const provider = new OllamaProvider({ fetchImpl: async () => ({ ok: false, status: 404 }) });
  await assert.rejects(provider.chat([{ role: 'user', content: 'hi' }]), /ollama pull/);
});

test('unavailable server reports actionable error', async () => {
  const provider = new OllamaProvider({ fetchImpl: async () => { throw new Error('ECONNREFUSED'); } });
  await assert.rejects(provider.chat([{ role: 'user', content: 'hi' }]), /Cannot reach local Ollama/);
});

test('empty model response is rejected', async () => {
  const provider = new OllamaProvider({ fetchImpl: async () => ({ ok: true, json: async () => ({ message: { content: ' ' } }) }) });
  await assert.rejects(provider.chat([{ role: 'user', content: 'hi' }]), /empty response/);
});
