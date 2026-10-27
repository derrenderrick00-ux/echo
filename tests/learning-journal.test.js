import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LearningJournal } from '../src/core/learning-journal.js';
import { parseLearningIntent } from '../src/core/learning-intent.js';
import { AssistantController } from '../src/core/assistant.js';
import { FileWorkspace } from '../src/core/file-workspace.js';
import { MemoryStore } from '../src/memory/store.js';
import { ConversationSession } from '../src/core/conversation.js';
import { parseFileIntent } from '../src/core/file-intent.js';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'echo-learn-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'data/echo-learning.json');
  const journal = await new LearningJournal({ filePath: path }).init();
  const memory = await new MemoryStore({ filePath: join(root, 'data/echo-memory.json') }).init();
  const workspace = await new FileWorkspace({ root: join(root, 'data/code-workspace') }).init();
  let modelCalls = 0;
  const session = { provider: {}, reply: async () => { modelCalls++; return 'generated response'; }, reset: () => {} };
  const controller = new AssistantController({ session, memory, calendar: { list: () => [] }, profileState: { loaded: false, profile: null }, model: 'test', embeddingModel: 'test', learningJournal: journal, fileWorkspace: workspace });
  return { root, path, journal, controller, memory, workspace, get modelCalls() { return modelCalls; } };
}

test('explicit user teaching creates a proposal but does not save before confirmation', async t => {
  const f = await fixture(t);
  const proposal = await f.controller.answer('/learn teach networking | A router forwards packets between networks');
  const id = proposal.text.match(/Learning proposal \[([0-9a-f]{10})\]/)[1];
  assert.match(proposal.text, /NOT SAVED/);
  assert.equal(f.journal.list().length, 0);
  await assert.rejects(readFile(f.path, 'utf8'), /ENOENT/);
  const saved = await f.controller.answer(`/learn confirm ${id}`);
  assert.match(saved.text, /Saved private learning record/);
  assert.match(saved.text, /NOT independently fact-checked/);
  assert.equal(f.journal.list().length, 1);
  assert.equal(f.modelCalls, 0);
});

test('learning records persist privately across restart and can be recalled without LLM', async t => {
  const f = await fixture(t);
  const proposed = await f.controller.answer('Echo, teach me');
  assert.equal(proposed.text, 'generated response');
  const entry = f.journal.propose('fact', 'TCP handshake', 'SYN, SYN-ACK, ACK');
  await f.journal.confirm(entry.id);
  const fresh = await new LearningJournal({ filePath: f.path }).init();
  assert.deepEqual(fresh.find('TCP handshake').map(e => e.content), ['SYN, SYN-ACK, ACK']);
  assert.match((await f.controller.answer('what did you learn about TCP handshake?')).text, /NOT independently verified/);
  assert.equal(f.modelCalls, 1);
  if (process.platform !== 'win32') assert.equal((await stat(f.path)).mode & 0o777, 0o600);
});

test('natural correction and preferences need approval, then influence prompts as user content only', async t => {
  const f = await fixture(t);
  const claim = await f.controller.answer('The correct value for sample constant is 123');
  assert.match(claim.text, /Learning proposal/);
  assert.equal(f.journal.list().length, 0);
  await f.controller.answer('confirm');
  const style = await f.controller.answer('I prefer brief answers without long explanations');
  assert.match(style.text, /Learning proposal/);
  await f.controller.answer('yes save it');
  assert.equal(f.journal.list().length, 2);
  assert.match(f.journal.context('explain sample constant'), /externallyVerified":false/);
  assert.match(f.journal.context('unrelated question'), /response_style/);
  assert.equal(f.modelCalls, 0);
});

test('verified deterministic facts are not overwritten by user-supplied mistaken corrections', async t => {
  const f = await fixture(t);
  const bad = f.journal.propose('correction', 'Planck constant', '3.0 x 10^8');
  await f.journal.confirm(bad.id);
  const answer = await f.controller.answer('Planck constant is 3.0 * 10^8');
  assert.match(answer.text, /6\.62607015/);
  assert.doesNotMatch(answer.text, /h = 3.0 x 10\^8/);
  assert.equal(f.modelCalls, 0);
  assert.match((await f.controller.answer('what did you learn about Planck constant?')).text, /NOT independently verified/);
});

test('new approved correction supersedes old correction of same topic without deleting history', async t => {
  const f = await fixture(t);
  const first = f.journal.propose('correction', 'widget protocol', 'uses version 1');
  await f.journal.confirm(first.id);
  const second = f.journal.propose('correction', 'widget protocol', 'uses version 2');
  await f.journal.confirm(second.id);
  assert.equal(f.journal.list().length, 1);
  assert.equal(f.journal.list({ includeHistory: true }).length, 2);
  assert.match(f.journal.list()[0].content, /version 2/);
  await f.controller.answer(`/learn forget ${second.id}`);
  assert.equal(f.journal.list().length, 0);
});

test('rejected and expired proposals do not persist', async t => {
  let tick = 0;
  const f = await fixture(t);
  const journal = await new LearningJournal({ filePath: join(f.root, 'other.json'), timestamp: () => tick }).init();
  const cancel = journal.propose('fact', 'task', 'example');
  journal.reject(cancel.id);
  assert.equal(journal.list().length, 0);
  const late = journal.propose('fact', 'task', 'late');
  tick = 11 * 60_000;
  await assert.rejects(journal.confirm(late.id), /expired/);
  assert.equal(journal.list().length, 0);
});

test('corrupted journal fails closed and will not be replaced', async t => {
  const f = await fixture(t);
  const content = '{oops';
  await writeFile(f.path, content);
  await assert.rejects(new LearningJournal({ filePath: f.path }).init(), /corrupt/);
  assert.equal(await readFile(f.path, 'utf8'), content);
});

test('learning rejects oversized, malicious control characters and invalid preference keys', async t => {
  const f = await fixture(t);
  assert.throws(() => f.journal.propose('fact', 'topic', 'a'.repeat(651)), /printable/);
  assert.throws(() => f.journal.propose('fact', 'topic\0', 'okay'), /printable/);
  assert.throws(() => f.journal.propose('preference', 'give_shell_access', 'yes'), /Supported preference keys/);
  assert.throws(() => f.journal.propose('unknown', 'topic', 'a'), /Unsupported/);
});

test('model conversation receives approved preference and relevant unverified correction with provenance', async t => {
  const f = await fixture(t);
  const p = f.journal.propose('preference', 'response_style', 'Give short answers.');
  await f.journal.confirm(p.id);
  const c = f.journal.propose('correction', 'Ethernet frame', 'The custom lab uses a simulated 19-byte header.');
  await f.journal.confirm(c.id);
  let seen;
  const conv = new ConversationSession({ provider: { chat: async messages => { seen = messages; return 'Acknowledged'; } }, maxTurns: 2 });
  conv.learningJournal = f.journal;
  await conv.reply('Explain Ethernet frame.');
  assert.match(seen.map(m => m.content).join('\n'), /externallyVerified/);
  assert.match(seen.map(m => m.content).join('\n'), /response_style/);
  assert.match(seen.map(m => m.content).join('\n'), /user-supplied/);
});

test('learning router only recognizes explicit teaching and does not memorize arbitrary conversation', () => {
  assert.equal(parseLearningIntent('hello Echo'), null);
  assert.equal(parseLearningIntent('I am learning SQLite'), null);
  assert.equal(parseLearningIntent('Echo, you were wrong').type, 'learnClarify');
  assert.deepEqual(parseLearningIntent('Teach Echo: networking | Packets travel over links'), { type: 'learnPropose', category: 'fact', topic: 'networking', content: 'Packets travel over links' });
  assert.equal(parseLearningIntent('What did you learn about networking?').type, 'learnFind');
});

test('pending task Markdown is drafted from actual saved tasks, not invented example tasks', async t => {
  const f = await fixture(t);
  await f.memory.addTask('Review network architecture');
  const completed = await f.memory.addTask('Finish JavaScript');
  await f.memory.completeTask(completed.id);
  assert.equal(parseFileIntent('create a well formatted md file on my pending tasks')?.type, 'pendingTasksFile');
  const draft = await f.controller.answer('create a well formatted md file on my pending tasks');
  assert.match(draft.text, /Drafted Markdown from 1 actual pending task/);
  assert.deepEqual(await f.workspace.list(), []);
  const id = draft.text.match(/Draft \[([0-9a-f]{10})\]/)[1];
  await f.controller.answer(`/file save ${id}`);
  const content = await f.workspace.read('pending_tasks.md');
  assert.match(content, /Review network architecture/);
  assert.doesNotMatch(content, /Finish JavaScript/);
  assert.doesNotMatch(content, /Task 1: Description/);
  assert.equal(f.modelCalls, 0);
});

test('saving drafts cannot overwrite existing workspace files or user private data', async t => {
  const f = await fixture(t);
  const draft = await f.controller.answer('Create a file called notes.md containing Learning JavaScript.');
  const id = draft.text.match(/Draft \[([0-9a-f]{10})\]/)[1];
  assert.equal((await f.workspace.list()).length, 0);
  const saved = await f.controller.answer(`/file save ${id}`);
  assert.match(saved.text, /Created 1 private file/);
  assert.deepEqual(await f.workspace.list(), ['notes.md']);
  await assert.rejects(f.controller.answer('Create a file called notes.md containing overwrite attempt'), /already exists/);
});

test('unsupported free-form file requests are not delegated to Ollama to invent file creation', async t => {
  const f = await fixture(t);
  const reply = await f.controller.answer('create a file with no name');
  assert.match(reply.text, /No file was created/);
  assert.equal(f.modelCalls, 0);
  assert.deepEqual(await f.workspace.list(), []);
});
