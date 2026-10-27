import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseIntent } from '../src/core/intent.js';
import { parseBaseConversion, convertNumber } from '../src/core/number-systems.js';
import { programmingFact } from '../src/core/programming-facts.js';
import { checkJavascriptSyntax } from '../src/core/code-syntax.js';
import { DailyReview } from '../src/core/daily-review.js';
import { AssistantController } from '../src/core/assistant.js';
import { MemoryStore } from '../src/memory/store.js';
import { LocalCalendar } from '../src/core/calendar.js';
import { Phase2Workspace } from '../src/core/phase2-workspace.js';
import { Phase2Commands } from '../src/core/phase2-commands.js';
import { CodeSandbox } from '../src/tools/sandbox.js';
import { ActionJournal } from '../src/core/action-journal.js';

async function fixture(t, now = '2026-10-26T08:00:00Z') {
  const root = await mkdtemp(join(tmpdir(), 'echo-031-'));
  t.after(async () => rm(root, { recursive: true, force: true }));
  const clock = () => new Date(now);
  const memory = await new MemoryStore({ filePath: join(root, 'memory.json'), clock }).init();
  const calendar = await new LocalCalendar({ filePath: join(root, 'calendar.json') }).init();
  const journal = await new ActionJournal({ filePath: join(root, 'journal.json'), clock }).init();
  const review = await new DailyReview({ filePath: join(root, 'review.json'), reportPath: join(root, 'report.json'), clock }).init();
  let calls = 0;
  const session = { provider: { maxOutputTokens: 256 }, reply: async text => { calls++; return 'LLM response'; }, reset: () => {} };
  const controller = new AssistantController({ session, memory, calendar, profileState: { loaded: false, profile: null }, model: 'mock', embeddingModel: 'mock', dailyReview: review });
  return { root, clock, memory, calendar, review, journal, controller, get calls() { return calls; } };
}

test('273 in hexadecimal uses verified arithmetic, not model guesses', () => {
  const data = parseBaseConversion('273 in hex');
  assert.equal(data, '273 (base 10) = 111 (base 16).');
  assert.equal(parseBaseConversion('convert 273 from decimal to hex'), data);
  assert.equal(parseBaseConversion('111 from hex to decimal'), '111 (base 16) = 273 (base 10).');
  assert.equal(parseBaseConversion('0x111 to decimal'), '111 (base 16) = 273 (base 10).');
  assert.equal(parseBaseConversion('1011 from binary to decimal'), '1011 (base 2) = 11 (base 10).');
  assert.equal(parseBaseConversion('273 in base 16'), data);
});

test('verified decimal, octal and binary conversions include negative and zero', () => {
  assert.equal(convertNumber('0', 10, 16), '0 (base 10) = 0 (base 16).');
  assert.equal(convertNumber('-15', 10, 16), '-15 (base 10) = -F (base 16).');
  assert.equal(convertNumber('777', 8, 10), '777 (base 8) = 511 (base 10).');
  assert.equal(convertNumber('111', 16, 2), '111 (base 16) = 100010001 (base 2).');
  assert.match(convertNumber('273', 10, 16, { steps: true }), /remainder 1/);
  assert.match(convertNumber('273', 10, 16, { steps: true }), /Verification: 111/);
});

test('invalid digits or unsupported bases are rejected, never guessed', () => {
  for (const bad of [['102', 2, 10], ['GG', 16, 10], ['1', 3, 10], ['', 10, 2]]) assert.throws(() => convertNumber(...bad));
  assert.equal(parseBaseConversion('Explain hex in C'), null);
});

test('natural task requests route past model including wake word without punctuation', async t => {
  const f = await fixture(t);
  await f.memory.addTask('Study Discrete Math');
  const pending = await f.controller.answer('echo what are my pending tasks');
  assert.match(pending.text, /Pending \(incomplete\) tasks/);
  assert.match(pending.text, /Study Discrete Math/);
  assert.equal(f.calls, 0);
  await f.memory.completeTask(f.memory.listTasks()[0].id);
  assert.doesNotMatch((await f.controller.answer('What are my pending tasks?')).text, /Study Discrete Math/);
  assert.match((await f.controller.answer('What have I completed?')).text, /Study Discrete Math/);
  assert.match((await f.controller.answer('Did I complete Discrete Math?')).text, /completed/);
  assert.equal(f.calls, 0);
});

test('task status is read-only and ambiguous matches do not pretend certainty', async t => {
  const f = await fixture(t);
  await f.memory.addTask('Learn MongoDB basics');
  await f.memory.addTask('Review MongoDB aggregation');
  const ambiguous = await f.controller.answer('is MongoDB done?');
  assert.match(ambiguous.text, /Several saved tasks match/);
  assert.equal(f.memory.listTasks().filter(x => x.done).length, 0);
  assert.equal(f.calls, 0);
});

test('daily review records only verified task completions and user-reported progress', async t => {
  const f = await fixture(t);
  const done = await f.memory.addTask('Networking revision');
  await f.memory.addTask('Finish Discrete Math');
  await f.memory.completeTask(done.id);
  await f.review.add('done', 'Built deterministic task router');
  await f.review.add('blocker', 'Ollama sometimes times out');
  await f.review.add('next', 'Finish voice acceptance tests');
  const report = await f.controller.answer('What did we accomplish today?');
  assert.match(report.text, /Networking revision/);
  assert.match(report.text, /manually reported/i);
  assert.match(report.text, /Finish Discrete Math/);
  assert.match(report.text, /Ollama sometimes times out/);
  assert.match(report.text, /Finish voice acceptance tests/);
  assert.doesNotMatch(report.text, /all.*119.*passed/i);
  assert.equal(f.calls, 0);
});

test('daily review refuses to silently replace corrupt records', async t => {
  const f = await fixture(t);
  await writeFile(join(f.root, 'review.json'), 'corrupt');
  await assert.rejects(new DailyReview({ filePath: join(f.root, 'review.json') }).init(), /cannot be read safely/);
});

test('daily review persists after restart and uses restrictive permissions', async t => {
  const f = await fixture(t);
  await f.review.add('next', 'Check tests');
  const again = await new DailyReview({ filePath: join(f.root, 'review.json'), clock: f.clock }).init();
  assert.equal(again.list().length, 1);
  assert.equal(again.list()[0].text, 'Check tests');
  if (process.platform !== 'win32') assert.equal((await stat(join(f.root, 'review.json'))).mode & 0o777, 0o600);
});

test('daily review reads actual test summary but does not invent counts', async t => {
  const f = await fixture(t);
  await writeFile(join(f.root, 'report.json'), JSON.stringify({ version: 1, at: '2026-10-26T09:00:00Z', passed: 130, failed: 1, total: 131, ok: false }));
  assert.match(await f.review.render({ memory: f.memory }), /130\/131 passed, 1 failed/);
});

test('development journal validates content and saves nothing on error', async t => {
  const f = await fixture(t);
  await assert.rejects(f.review.add('done', ''), /1–300/);
  await assert.rejects(f.review.add('unknown', 'Hi'), /Log type/);
  assert.equal(f.review.list().length, 0);
});

test('development log CLI records manual items with accurate source labels', async t => {
  const f = await fixture(t);
  assert.match((await f.controller.answer('/devlog done Fixed number conversions')).text, /user-reported/);
  assert.match((await f.controller.answer('/devlog list')).text, /Fixed number conversions/);
  assert.equal(f.calls, 0);
});

test('natural uncommitted study plan requests approval rather than writing silently', () => {
  assert.deepEqual(parseIntent('I will study discrete math'), { type: 'suggestTask', text: 'study discrete math' });
  assert.equal(parseIntent('I am studying today'), null);
});

test('C remainder versus formatting is distinguished even with two percent uses', () => {
  const answer = programmingFact('what does % do in the program', { previousAnswer: 'int n = rand() % 100; printf("%d", n);' });
  assert.match(answer, /remainder operator/);
  assert.match(answer, /format specifier/);
  assert.match(answer, /rand\(\) % 100/);
});

test('arrow function fact sheet does not claim parameters are inferred', () => {
  const answer = programmingFact('teach me arrow functions');
  assert.match(answer, /must declare them/);
  assert.match(answer, /lexically/);
  assert.doesNotMatch(answer, /parameter names are inferred/);
});

test('JavaScript parser checks syntax but never executes user source', () => {
  const valid = checkJavascriptSyntax('throw new Error("would execute if unsafe");');
  assert.equal(valid.valid, true);
  assert.match(valid.output, /syntax ONLY/);
  const invalid = checkJavascriptSyntax('const n = ;');
  assert.equal(invalid.valid, false);
  assert.match(invalid.output, /SyntaxError|syntax error/i);
});

test('code syntax command checks private workspace without executing code', async t => {
  const f = await fixture(t);
  const store = await new Phase2Workspace({ filePath: join(f.root, 'phase2.json') }).init();
  const sandbox = await new CodeSandbox({ workspaceDir: join(f.root, 'code') }).init();
  await writeFile(join(f.root, 'code', 'source.js'), 'const a = (n) => n + 1;');
  const commands = new Phase2Commands({ workspace: store, sandbox });
  assert.match((await commands.handle('/code syntax source.js')).text, /parser accepted/);
  await writeFile(join(f.root, 'code', 'source.js'), 'const a = ;');
  assert.match((await commands.handle('/code syntax source.js')).text, /syntax error/i);
});

test('intent corpus is a truthful routing measurement not LLM accuracy', async () => {
  const corpus = JSON.parse(await readFile(new URL('../evaluation/intent-cases.json', import.meta.url), 'utf8'));
  assert.ok(corpus.length >= 40);
  const errors = corpus.filter(x => (parseIntent(x.input)?.type ?? null) !== x.intent);
  assert.deepEqual(errors, []);
});

test('assistant returns verified conversion without consulting language model', async t => {
  const f = await fixture(t);
  assert.equal((await f.controller.answer('273 in hex')).text, '273 (base 10) = 111 (base 16).');
  assert.match((await f.controller.answer('173?')).text, /111 \(base 16\)/);
  assert.equal(f.calls, 0);
});

test('pending task synonym routes not accidentally treated as unrelated chat', async t => {
  const f = await fixture(t);
  await f.memory.addTask('Practice SQL');
  for (const phrase of ['What is left?', 'What are my pending tasks?', 'show my incomplete tasks', 'What do I still need to do?']) {
    assert.match((await f.controller.answer(phrase)).text, /Practice SQL/);
  }
  assert.equal(f.calls, 0);
});

test('no fabricated priority assigned to unranked task list', async t => {
  const f = await fixture(t);
  await f.memory.addTask('Review algorithms');
  assert.match((await f.controller.answer('What should I work on next?')).text, /not ranked by urgency/);
});
