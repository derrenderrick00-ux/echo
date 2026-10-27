import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrivateContext } from '../src/core/private-context.js';
import { ProgressInterview, INTERVIEW_QUESTIONS } from '../src/core/progress-interview.js';
import { parseSmartMemory } from '../src/core/smart-memory.js';
import { parseFileIntent } from '../src/core/file-intent.js';
import { AssistantController } from '../src/core/assistant.js';
import { ConversationSession } from '../src/core/conversation.js';
import { MemoryStore } from '../src/memory/store.js';

const simpleSeed = () => ({
  version: 1,
  person: { displayName: 'Test person', education: 'Student' },
  learning: [{ name: 'Networking', detail: 'Learning routers', source: 'user-reported' }],
  projects: [{ name: 'Echo', detail: 'Under test', status: 'active', source: 'user-reported' }],
  preferences: [{ name: 'Response style', detail: 'Short answers', source: 'user-reported' }],
  roadmap: [{ name: 'Next', detail: 'Test profile', source: 'user-reported' }],
  interviews: [], importedAt: null,
});

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'echo-final-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const seedPath = join(dir, 'seed.json');
  await writeFile(seedPath, JSON.stringify(simpleSeed()));
  const context = await new PrivateContext({ filePath: join(dir, 'context.json'), seedPath }).init();
  return { dir, seedPath, context };
}

test('private seed import needs preview, confirmation and restrictive permissions', async t => {
  const { dir, context } = await fixture(t);
  await assert.rejects(() => context.confirmImport(), /preview/);
  const preview = await context.previewImport();
  assert.match(preview, /NOT imported|not imported/i);
  assert.equal(context.data.projects.length, 0);
  await context.confirmImport();
  assert.equal(context.data.projects[0].name, 'Echo');
  const reopened = await new PrivateContext({ filePath: join(dir, 'context.json'), seedPath: join(dir, 'seed.json') }).init();
  assert.equal(reopened.data.learning.length, 1);
  assert.equal((await stat(join(dir, 'context.json'))).mode & 0o777, 0o600);
  await assert.rejects(() => context.previewImport(), /already contains records/);
});

test('tampered seed refuses import, does not silently overwrite', async t => {
  const { seedPath, context } = await fixture(t);
  await context.previewImport();
  await writeFile(seedPath, JSON.stringify({ ...simpleSeed(), person: { displayName: 'Changed' } }));
  await assert.rejects(() => context.confirmImport(), /changed since preview/);
  assert.equal(context.data.projects.length, 0);
});

test('corrupt profile context fails closed, not overwritten', async t => {
  const { dir } = await fixture(t);
  const contextPath = join(dir, 'context.json');
  await writeFile(contextPath, '{bad json');
  await assert.rejects(() => new PrivateContext({ filePath: contextPath, seedPath: join(dir, 'seed.json') }).init(), /could not load safely/);
  assert.equal(await readFile(contextPath, 'utf8'), '{bad json');
});

test('private interview uses salted scrypt and locks after completion', async t => {
  const { dir, context } = await fixture(t);
  await context.previewImport();
  await context.confirmImport();
  const gate = await new ProgressInterview({ secretPath: join(dir, 'key.json'), context }).init();
  await assert.rejects(() => gate.setup('short'), /12–128/);
  const secret = 'unique secret combination 963!';
  await gate.setup(secret);
  const keyFile = await readFile(join(dir, 'key.json'), 'utf8');
  assert.doesNotMatch(keyFile, /unique secret/);
  assert.equal((await stat(join(dir, 'key.json'))).mode & 0o777, 0o600);
  assert.throws(() => gate.start(), /locked/);
  assert.throws(() => gate.unlock('wrong'), /Incorrect/);
  assert.match(gate.unlock(secret), /unlocked/);
  assert.match(gate.start(), /Question 1/);
  for (let i = 0; i < INTERVIEW_QUESTIONS.length; i++) gate.answer(i === 3 ? 'Echo: active - Phase 3 testing' : `Update ${i + 1}`);
  assert.equal(context.data.interviews.length, 0);
  assert.match(gate.preview(), /UNCOMMITTED/);
  await gate.confirm();
  assert.equal(context.data.interviews.length, 1);
  assert.equal(context.data.projects[0].status, 'active');
  assert.match(context.format('interview'), /Phase 3 testing/);
  assert.throws(() => gate.start(), /locked/);
});

test('wrong combinations rate limit and no prompt serialization of cleartext', async t => {
  const { dir, context } = await fixture(t);
  let now = 1000;
  const gate = await new ProgressInterview({ secretPath: join(dir, 'key.json'), context, clock: () => now }).init();
  await gate.setup('testing secret combination 214!');
  for (let i = 0; i < 3; i++) assert.throws(() => gate.unlock('incorrect'), /Incorrect/);
  assert.throws(() => gate.unlock('testing secret combination 214!'), /five minutes/);
  now += 300001;
  assert.match(gate.unlock('testing secret combination 214!'), /unlocked/);
});

test('project proposals do not write until confirmation', async t => {
  const { context } = await fixture(t);
  await context.previewImport();
  await context.confirmImport();
  const message = context.proposeProject('Echo', 'maintenance', 'Temporarily waiting on hardware');
  assert.match(message, /NOT SAVED/);
  assert.equal(context.data.projects[0].status, 'active');
  const proposal = context.projectProposal;
  await assert.rejects(() => context.confirmProject('wrong-id'), /No matching/);
  await context.confirmProject(proposal.id);
  assert.equal(context.data.projects[0].status, 'maintenance');
});

test('smart memory routes notes tasks outcomes preferences projects and calendar independently', () => {
  assert.deepEqual(parseSmartMemory('Echo, add to memory: task | Review JavaScript'), { type: 'task', content: 'Review JavaScript' });
  assert.deepEqual(parseSmartMemory('add to memory that I need to study discrete maths'), { type: 'task', content: 'study discrete maths' });
  assert.deepEqual(parseSmartMemory('remember that I am learning Express.js'), { type: 'note', content: 'I am learning Express.js' });
  assert.deepEqual(parseSmartMemory('add to memory: completed task | Review networking'), { type: 'complete', content: 'Review networking' });
  assert.deepEqual(parseSmartMemory('add to memory: project | Echo | active | testing'), { type: 'project', name: 'Echo', status: 'active', content: 'testing' });
  assert.deepEqual(parseSmartMemory('add to memory: correction | Planck | correct explanation'), { type: 'learning', category: 'correction', name: 'Planck', content: 'correct explanation' });
  assert.deepEqual(parseSmartMemory('add to memory: event | 2026-11-01T09:00+03:00 | revision'), { type: 'event', at: '2026-11-01T09:00+03:00', content: 'revision' });
  assert.equal(parseSmartMemory('What are my pending tasks?'), null);
});

test('file router accepts previously failed pending-task Markdown variants', () => {
  for (const line of ['create an md file on my pending tasks', 'create a well formated md file in pending_tasks', 'create and tell me where you saved file on my pending tasks']) assert.equal(parseFileIntent(line)?.type, 'pendingTasksFile');
});

test('assistant saves notes and tasks through appropriate stores without Ollama', async t => {
  const { dir, context } = await fixture(t);
  let called = 0;
  const provider = { chat: async () => { called++; return 'unused'; } };
  const memory = await new MemoryStore({ filePath: join(dir, 'memory.json') }).init();
  const session = new ConversationSession({ provider, memory });
  const controller = new AssistantController({ session, memory, calendar: { add: () => null, list: () => [] }, profileState: { loaded: false, profile: null }, model: 'dummy', embeddingModel: 'none', privateContext: context });
  const task = await controller.process('add to memory that I need to review SQL');
  assert.match(task.text, /Added task/);
  const note = await controller.process('remember that I am learning Express.js');
  assert.match(note.text, /Saved note/);
  assert.equal(memory.listTasks({ includeDone: false }).length, 1);
  assert.equal(memory.listNotes().length, 1);
  assert.equal(called, 0);
});

test('model context carries bounded verified-provenance user background, not whole seed', async t => {
  const { context } = await fixture(t);
  await context.previewImport();
  await context.confirmImport();
  const relevant = context.relevant('what is my progress on networking');
  assert.match(relevant, /Networking/);
  assert.match(relevant, /reference DATA/);
  assert.ok(relevant.length <= 1150);
  assert.match(context.relevant('hello'), /User-reported response preference/);
});

test('spoken explicit smart memory changes remain pending until a second voice confirmation', async t => {
  const { dir, context } = await fixture(t);
  const heard = ['add to memory: task | Study graph theory', 'confirm'];
  const memory = await new MemoryStore({ filePath: join(dir, 'memory.json') }).init();
  const provider = { chat: async () => { throw new Error('LLM should not run for deterministic task routing'); } };
  const voice = { requireInput: async () => {}, listen: async () => heard.shift() };
  const controller = new AssistantController({ session: new ConversationSession({ provider, memory }), memory, calendar: { list: () => [] }, profileState: { loaded: false, profile: null }, model: 'none', embeddingModel: 'none', voice, privateContext: context });
  const proposed = await controller.hearAndAnswer(5);
  assert.match(proposed.text, /Nothing was saved yet/);
  assert.equal(memory.listTasks().length, 0);
  const accepted = await controller.hearAndAnswer(5);
  assert.match(accepted.text, /Added task/);
  assert.equal(memory.listTasks().length, 1);
});


test('explicit personal questions use saved profile facts rather than model guesses', async t => {
  const { context } = await fixture(t);
  await context.previewImport();
  await context.confirmImport();
  const userMethod = context.answerKnown('what is my study method');
  assert.match(userMethod, /not have a confirmed learning method/);
  assert.match(context.answerKnown('where do I study?'), /Student/);
  assert.match(context.answerKnown('list my projects'), /Echo/);
  assert.equal(context.answerKnown('hello'), null);
});
