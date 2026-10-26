import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalCalendar, formatEvents } from '../src/core/calendar.js';
import { MemoryStore } from '../src/memory/store.js';
import { AssistantController } from '../src/core/assistant.js';
import { Games } from '../src/core/games.js';
import { summarizeText, decisionPrompt } from '../src/core/summarize.js';
import { LocalVoice } from '../src/providers/voice.js';
import { binaryAddition, calculateText } from '../src/core/math.js';
import { parseIntent } from '../src/core/intent.js';

const now = () => new Date('2026-10-26T09:00:00+03:00');

async function fixture(t) {
  const folder = await mkdtemp(join(tmpdir(), 'echo-phase1-'));
  t.after(async () => rm(folder, { force: true, recursive: true }));
  const memory = await new MemoryStore({ filePath: join(folder, 'memory.json'), clock: now }).init();
  const calendar = await new LocalCalendar({ filePath: join(folder, 'calendar.json'), clock: now }).init();
  const calls = [];
  const session = { provider: { lastTruncated: false }, reply: async (input, options) => {
    calls.push(input);
    if (options?.onToken) options.onToken('Simulated AI');
    return 'Simulated AI';
  }, reset: () => {} };
  const controller = new AssistantController({ session, memory, calendar, profileState: { loaded: true, profile: { displayName: 'Test User', goals: ['Learn programming'], currentFocus: 'Build an AI' } }, model: 'local-test', embeddingModel: 'fake', statusText: () => 'test', clock: now });
  return { memory, calendar, calls, controller, folder };
}

test('binary column addition uses exact arithmetic and lists carries', () => {
  assert.match(binaryAddition('43', '97'), /43 \+ 97 = 140/);
  assert.match(calculateText('show me the calculation process for 43 + 97 in binary'), /10001100/);
  assert.match(binaryAddition('43', '97'), /Column 0/);
});

test('direct task request does not hallucinate inability to access local storage', async t => {
  const { controller, memory } = await fixture(t);
  await memory.addTask('Review networking');
  const result = await controller.answer('what are my current tasks');
  assert.match(result.text, /Review networking/);
  assert.equal(result.streamed, undefined);
});

test('memory requests including typo and add to memory write a real note', async t => {
  const { controller, memory } = await fixture(t);
  await controller.answer("remmember I'm studying SQL");
  await controller.answer("add to memory that I'm learning Node.js");
  assert.equal(memory.listNotes().length, 2);
  assert.match(memory.listNotes()[1].text, /Node\.js/);
  assert.deepEqual(parseIntent('what date is today'), { type: 'datetime' });
});

test('date, help and capabilities bypass LLM and use application state', async t => {
  const { controller, calls } = await fixture(t);
  assert.match((await controller.answer('what date is today')).text, /26 October 2026/);
  assert.match((await controller.answer('show me the menu')).text, /\/event add/);
  assert.match((await controller.answer('what can you do?')).text, /Not implemented/);
  assert.equal(calls.length, 0);
});

test('saved calendar events persist after restart and format using timezone', async t => {
  const { calendar, folder } = await fixture(t);
  const item = await calendar.add('2026-10-26T11:00+03:00', 'Review SQL');
  const second = await new LocalCalendar({ filePath: join(folder, 'calendar.json'), clock: now }).init();
  assert.equal(second.list()[0].title, 'Review SQL');
  assert.match(formatEvents(second.list()), /Review SQL/);
  assert.equal(await second.remove(item.id), true);
  assert.equal(second.list().length, 0);
});

test('calendar validates event time and disallows past dates', async t => {
  const { calendar } = await fixture(t);
  await assert.rejects(calendar.add('2026-10-25T09:00+03:00', 'Past'));
  await assert.rejects(calendar.add('2026-11-01 09:00', 'Missing timezone'));
});

test('local due event checks fire only once and only within grace window', async t => {
  const folder = await mkdtemp(join(tmpdir(), 'echo-clock-'));
  t.after(async () => rm(folder, { recursive: true, force: true }));
  let current = new Date('2026-10-26T06:00:00Z');
  const calendar = await new LocalCalendar({ filePath: join(folder,'c.json'), clock: () => current }).init();
  await calendar.add('2026-10-26T09:02+03:00', 'Daily review');
  assert.equal((await calendar.due()).length, 0);
  current = new Date('2026-10-26T06:03:00Z');
  assert.equal((await calendar.due()).length, 1);
  assert.equal((await calendar.due()).length, 0);
});

test('local briefing uses stored tasks and no invented external calendar', async t => {
  const { controller, memory } = await fixture(t);
  await memory.addTask('Read system architecture');
  const result = await controller.answer('/brief morning');
  assert.match(result.text, /Read system architecture/);
  assert.match(result.text, /No external calendar was checked/);
});

test('extractive summaries do not add information not in supplied text', () => {
  const result = summarizeText('The team met at noon. We must fix the bug. Deployment is pending.');
  assert.match(result, /We must fix the bug/);
  assert.doesNotMatch(result, /deployed successfully/);
  assert.throws(() => decisionPrompt('Only one option'));
  assert.match(decisionPrompt('Use SQLite | Use PostgreSQL'), /uncertainties/);
});

test('session game state supports exit, correct feedback and no trivia repetition', () => {
  const game = new Games();
  assert.match(game.start('trivia', 'technology'), /Question 1/);
  const r = game.respond('B');
  assert.match(r, /Score:/);
  assert.match(r, /Question 2/);
  assert.match(game.respond('q'), /Game ended/);
  assert.equal(game.state, null);
  assert.match(game.start('wordchain'), /FROG/);
  assert.match(game.respond('garden'), /My word/);
});

test('voice module fails clearly when models are not configured', async () => {
  const voice = new LocalVoice();
  assert.match(voice.status(), /NOT configured/);
  await assert.rejects(voice.listen(), /Whisper model not configured/);
  await assert.rejects(voice.speak('Hello'), /Piper model not configured/);
});

test('decision requests call model with an explicit uncertainty instruction', async t => {
  const { controller, calls } = await fixture(t);
  assert.match((await controller.answer('/decide SQL | MongoDB')).text, /Simulated AI/);
  assert.match(calls[0], /Do not invent factual details/);
});

test('offline voice adapter sends distinct arguments to local transcription binary', async t => {
  const folder = await mkdtemp(join(tmpdir(), 'echo-voice-fixture-'));
  t.after(async () => rm(folder, { recursive: true, force: true }));
  const model = join(folder, 'model.bin');
  const audio = join(folder, 'voice.wav');
  const { writeFile } = await import('node:fs/promises');
  await writeFile(model, 'fixture');
  await writeFile(audio, 'fixture');
  const calls = [];
  const voice = new LocalVoice({ whisperModel: model, runImpl: async (bin, args) => { calls.push({ bin, args }); return 'Hello Echo'; } });
  assert.equal(await voice.transcribe(audio), 'Hello Echo');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].bin, 'whisper-cli');
  assert.deepEqual(calls[0].args.slice(0, 4), ['-m', model, '-f', audio]);
});

test('offline Piper speech uses argument arrays, temporary files and playback', async t => {
  const folder = await mkdtemp(join(tmpdir(), 'echo-piper-fixture-'));
  t.after(async () => rm(folder, { recursive: true, force: true }));
  const model = join(folder, 'voice.onnx');
  const { writeFile } = await import('node:fs/promises');
  await writeFile(model, 'fixture');
  const calls = [];
  const voice = new LocalVoice({ piperModel: model, runImpl: async (bin, args, options) => {
    calls.push({ bin, args, options });
    if (bin === 'piper') await writeFile(args[3], 'synthetic test audio');
    return '';
  } });
  assert.equal(await voice.speak('Hello world'), true);
  assert.deepEqual(calls.map(call => call.bin), ['piper', 'aplay']);
  assert.equal(calls[0].options.stdinText, 'Hello world');
});

test('public master specification excludes populated human profile', async () => {
  const source = await readFile(new URL('../Echo_Master_Document.md', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /PART 2.*POPULATED|Derrick Barasa|Nyeri, Kenya|Infinix Hot 60i/i);
  assert.match(source, /Git history and privacy caution/);
});

test('arithmetic assertions are checked rather than agreeing to false corrections', () => {
  assert.equal(calculateText('43+97 is 142'), 'Correction: 43 + 97 = 140, not 142.');
  assert.equal(calculateText('43+97=140'), 'Verified: 43 + 97 = 140.');
});
