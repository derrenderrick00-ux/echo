import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AssistantController } from '../src/core/assistant.js';
import { MemoryStore } from '../src/memory/store.js';
import { LocalCalendar } from '../src/core/calendar.js';
import { LocalVoice } from '../src/providers/voice.js';
import { parseIntent } from '../src/core/intent.js';
import { calculateText } from '../src/core/math.js';
import { readConfig } from '../src/core/config.js';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'echo-accuracy-'));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  const memory = await new MemoryStore({ filePath: join(directory, 'memory.json') }).init();
  const calendar = await new LocalCalendar({ filePath: join(directory, 'calendar.json') }).init();
  const calls = [];
  const provider = { timeoutMs: 300000, maxOutputTokens: 768, numCtx: 4096 };
  const session = { provider, reply: async text => { calls.push(text); return 'simulated answer'; }, reset: () => {} };
  const controller = new AssistantController({ session, memory, calendar, profileState: { loaded: true, profile: { displayName: 'Test Owner' } }, model: 'llama3.2:3b', embeddingModel: 'all-minilm', voice: new LocalVoice(), clock: () => new Date('2026-10-26T12:00:00+03:00') });
  return { controller, calls, directory };
}

test('direct binary follow-up stays on math instead of earlier conversation', async t => {
  const { controller, calls } = await fixture(t);
  const first = await controller.answer('43 + 97 in binary');
  assert.match(first.text, /10001100/);
  const short = await controller.answer('just direct answer');
  assert.equal(short.text, '43 + 97 = 140₁₀ = 10001100₂.');
  const rephrased = await controller.answer('i need a direct answer on 43 + 97 in binary');
  assert.equal(rephrased.text, '43 + 97 = 140₁₀ = 10001100₂.');
  assert.equal(calls.length, 0);
});

test('standalone direct-answer request does not invent previous computations', async t => {
  const { controller } = await fixture(t);
  assert.match((await controller.answer('just direct answer')).text, /Specify the exact question/);
});

test('date variants and JavaScript Date expression return application clock, not model guess', async t => {
  const { controller, calls } = await fixture(t);
  assert.match((await controller.answer("what is today's date")).text, /26 October 2026/);
  assert.match((await controller.answer('run date() in your js file')).text, /new Date\(\)/);
  assert.equal(calls.length, 0);
});

test('voice enablement requests cannot claim audio is already active', async t => {
  const { controller, calls } = await fixture(t);
  assert.match((await controller.answer('i want you to respond with voice')).text, /Voice replies not enabled/i);
  assert.match((await controller.answer('help me configure your voice')).text, /docs\/VOICE_SETUP_UBUNTU\.md/);
  assert.match((await controller.answer('why does your voice not working')).text, /docs\/VOICE_SETUP_UBUNTU\.md/);
  assert.match((await controller.answer('/voice setup')).text, /Do not reinstall Node\.js/);
  assert.equal(calls.length, 0);
});

test('runtime timeout explanation reflects actual configured deadline', async t => {
  const { controller, calls } = await fixture(t);
  assert.match((await controller.answer('what do you mean by Ollama stream timed out')).text, /300 seconds/);
  assert.match((await controller.answer('/diagnostics')).text, /300 seconds/);
  assert.equal(calls.length, 0);
});

test('valid timeout environment is accepted and bad values rejected', () => {
  const env = { ECHO_OLLAMA_TIMEOUT_MS: '600000', ECHO_OLLAMA_MODEL: 'llama3.2:3b' };
  assert.equal(readConfig({ env }).timeoutMs, 600000);
  assert.throws(() => readConfig({ env: { ECHO_OLLAMA_TIMEOUT_MS: '1000' } }), /ECHO_OLLAMA_TIMEOUT_MS/);
});

test('parsers distinguish technical words from executable requests', () => {
  assert.equal(parseIntent('teach me system architecture'), null);
  assert.equal(parseIntent('I want to learn how Whisper works'), null);
  assert.equal(calculateText('i need a direct answer on 43 + 97 in binary'), '43 + 97 = 140₁₀ = 10001100₂.');
});

test('Piper module mode invokes Python module with argument array', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'echo-piper-module-'));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  const model = join(directory, 'voice.onnx');
  await writeFile(model, 'test model placeholder');
  await writeFile(`${model}.json`, '{}');
  const calls = [];
  const voice = new LocalVoice({ piperMode: 'module', piperModel: model, piperBin: '/usr/bin/python3', runImpl: async (bin, args) => {
    calls.push({ bin, args });
    if (args[0] === '-m') await writeFile(args[5], 'fake speech');
    return '';
  } });
  await voice.speak('Hello, Echo');
  assert.equal(calls[0].bin, '/usr/bin/python3');
  assert.deepEqual(calls[0].args.slice(0, 5), ['-m', 'piper', '-m', model, '-f']);
  assert.deepEqual(calls[0].args.slice(-2), ['--', 'Hello, Echo']);
  assert.equal(calls[1].bin, 'aplay');
});
