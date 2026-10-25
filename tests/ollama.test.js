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

test('streamed response forwards tokens in order and keeps complete answer', async () => {
  const chunks = [
    '{"message":{"content":"Hello "},"done":false}\n{"message":{"content":"Der',
    'rick"},"done":false}\n{"done":true}\n',
  ];
  const provider = new OllamaProvider({ fetchImpl: async (url, options) => {
    assert.equal(JSON.parse(options.body).stream, true);
    return { ok: true, body: (async function* () { for (const c of chunks) yield Buffer.from(c); })() };
  }});
  let seen = '';
  const answer = await provider.chat([{ role: 'user', content: 'hi' }], { onToken: token => { seen += token; } });
  assert.equal(answer, 'Hello Derrick');
  assert.equal(seen, 'Hello Derrick');
});

test('prematurely terminated stream is rejected', async () => {
  const provider = new OllamaProvider({ fetchImpl: async () => ({ ok: true,
    body: (async function* () { yield Buffer.from('{"message":{"content":"part"}}\n'); })(),
  }) });
  await assert.rejects(provider.chat([{ role: 'user', content: 'hi' }], { onToken() {} }), /prematurely/);
});
