import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AssistantController } from '../src/core/assistant.js';
import { MemoryStore } from '../src/memory/store.js';
import { LocalCalendar } from '../src/core/calendar.js';
import { LocalVoice } from '../src/providers/voice.js';

async function createController(t, voice) {
  const root = await mkdtemp(join(tmpdir(), 'echo-voice-interaction-'));
  t.after(async () => rm(root, { recursive: true, force: true }));
  const memory = await new MemoryStore({ filePath: join(root, 'memory.json') }).init();
  const calendar = await new LocalCalendar({ filePath: join(root, 'calendar.json') }).init();
  const calls = [];
  const controller = new AssistantController({
    session: { provider: {}, reply: async text => { calls.push(text); return `Response to: ${text}`; }, reset: () => {} },
    memory, calendar, voice,
    profileState: { loaded: true, profile: { displayName: 'Test Person' } },
    model: 'local-test', embeddingModel: 'fake',
  });
  return { controller, memory, calls };
}

function fakeVoice({ speech = 'What is 3 plus 2?' } = {}) {
  const calls = { outputs: [], listens: [], checks: [] };
  return {
    calls,
    status: () => 'Test voice is configured',
    check: async () => 'Test voice ready',
    requireOutput: async () => calls.checks.push('output'),
    requireInput: async () => calls.checks.push('input'),
    listen: async ({ seconds }) => { calls.listens.push(seconds); return speech; },
    speak: async text => { calls.outputs.push(text); return true; },
  };
}

test('explicit voice mode speaks replies until switched off', async t => {
  const voice = fakeVoice();
  const { controller } = await createController(t, voice);
  assert.match((await controller.answer('/voice on')).text, /enabled/);
  const math = await controller.answer('43 + 97 in binary');
  assert.equal(math.speak, true);
  assert.match(math.text, /10001100/);
  assert.match((await controller.answer('/voice off')).text, /disabled/);
  assert.equal((await controller.answer('43 + 97 in binary')).speak, undefined);
});

test('natural language can request one spoken reply without enabling always-on voice', async t => {
  const voice = fakeVoice();
  const { controller, calls } = await createController(t, voice);
  const result = await controller.answer('answer in voice hello echo');
  assert.equal(result.speak, true);
  assert.equal(result.text, 'Response to: hello echo');
  assert.deepEqual(calls, ['hello echo']);
  const second = await controller.answer('ordinary question');
  assert.equal(second.speak, undefined);
});

test('voice ask transcribes and answers without automatically speaking', async t => {
  const voice = fakeVoice({ speech: 'What is the current date?' });
  const { controller, calls } = await createController(t, voice);
  const result = await controller.answer('/voice ask 4');
  assert.equal(result.heard, 'What is the current date?');
  assert.match(result.text, /\d{4}/);
  assert.equal(result.speak, undefined);
  assert.deepEqual(voice.calls.listens, [4]);
  assert.equal(calls.length, 0);
});

test('voice chat transcribes the question and requests speech playback', async t => {
  const voice = fakeVoice({ speech: 'Explain a router' });
  const { controller, calls } = await createController(t, voice);
  const result = await controller.answer('/voice chat 5');
  assert.equal(result.heard, 'Explain a router');
  assert.equal(result.text, 'Response to: Explain a router');
  assert.equal(result.speak, true);
  assert.deepEqual(calls, ['Explain a router']);
});

test('natural listen command records and processes spoken question', async t => {
  const voice = fakeVoice({ speech: 'Who created Echo?' });
  const { controller } = await createController(t, voice);
  const result = await controller.answer('listen to me');
  assert.match(result.text, /human creator/);
  assert.deepEqual(voice.calls.listens, [5]);
});

test('voice input cannot silently add notes or issue slash commands', async t => {
  const voice = fakeVoice({ speech: 'Remember that I am learning security' });
  const { controller, memory, calls } = await createController(t, voice);
  const result = await controller.answer('/voice chat 5');
  assert.match(result.text, /Type it to confirm/);
  assert.equal(memory.listNotes().length, 0);
  assert.equal(calls.length, 0);
});

test('missing voice setup prevents enabling speech or sending one-shot query', async t => {
  const { controller, calls } = await createController(t, new LocalVoice());
  assert.match((await controller.answer('/voice on')).text, /not enabled.*Piper model is not configured/i);
  assert.match((await controller.answer('answer in voice introduce yourself')).text, /Cannot speak this response/);
  assert.equal(calls.length, 0);
});

test('voice replay uses the last deterministic response', async t => {
  const voice = fakeVoice();
  const { controller } = await createController(t, voice);
  await controller.answer('43 + 97 in binary');
  assert.match((await controller.answer('/voice reply')).text, /Finished speaking/);
  assert.match(voice.calls.outputs[0], /10001100/);
});

test('Piper .bin configuration is rejected with actionable .onnx instruction', async t => {
  const voice = new LocalVoice({ piperModel: '/tmp/fake-voice.bin' });
  await assert.rejects(voice.requireOutput(), /\.onnx/);
});

test('Piper output requires its matching JSON configuration file', async t => {
  const root = await mkdtemp(join(tmpdir(), 'echo-piper-files-'));
  t.after(async () => rm(root, { recursive: true, force: true }));
  const model = join(root, 'voice.onnx');
  await writeFile(model, 'placeholder');
  const voice = new LocalVoice({ piperModel: model, piperMode: 'module', piperBin: '/usr/bin/python3', runImpl: async () => '' });
  await assert.rejects(voice.requireOutput(), /configuration file is missing/);
  await writeFile(`${model}.json`, '{}');
  await voice.requireOutput();
});
