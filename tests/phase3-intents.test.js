import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseIntent } from '../src/core/intent.js';
import { AssistantController } from '../src/core/assistant.js';
import { MemoryStore } from '../src/memory/store.js';
import { LocalCalendar } from '../src/core/calendar.js';
import { ActionJournal } from '../src/core/action-journal.js';
import { ManualSync } from '../src/core/phase3-sync.js';
import { calculateText } from '../src/core/math.js';

async function assistantFixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'echo-phase3-task-'));
  t.after(async () => rm(dir, { recursive: true, force: true }));
  const memory = await new MemoryStore({ filePath: join(dir, 'memory.json') }).init();
  const calendar = await new LocalCalendar({ filePath: join(dir, 'calendar.json') }).init();
  const journal = await new ActionJournal({ filePath: join(dir, 'actions.json') }).init();
  const sync = await new ManualSync({ directory: join(dir, 'sync'), memory }).init();
  let modelCalls = 0;
  const session = { provider: {}, reply: async () => { modelCalls++; return 'Model response'; }, reset: () => {} };
  const controller = new AssistantController({ session, memory, calendar, actionJournal: journal, manualSync: sync, profileState: {loaded: false, profile: null}, model: 'local', embeddingModel: 'local' });
  return { dir, memory, calendar, journal, sync, controller, get modelCalls() { return modelCalls; } };
}

test('natural imperative task commands store real tasks without invoking model', async t => {
  const f = await assistantFixture(t);
  for (const phrase of ['Add a task to revise networking', 'Put finish my DSA lesson on my to-do list', 'Can you create a task for practice SQL?', 'Remind me to study JavaScript']) {
    const result = await f.controller.answer(phrase);
    assert.match(result.text, /Added task/);
  }
  assert.equal(f.memory.listTasks().length, 4);
  assert.equal(f.modelCalls, 0);
  assert.match((await f.controller.answer('What is on my plate?')).text, /networking/);
  assert.match((await f.controller.answer('Remind me to finish TNest')).text, /did not schedule a notification/);
  assert.equal(f.memory.listTasks().length, 5);
  assert.equal(f.modelCalls, 0);
});

test('conversational statement is proposed but not silently stored', async t => {
  const f = await assistantFixture(t);
  const result = await f.controller.answer('I need to study Express.js');
  assert.match(result.text, /Approval needed/);
  assert.equal(f.memory.listTasks().length, 0);
  const pending = f.journal.list()[0];
  assert.match((await f.controller.answer(`/approve ${pending.id}`)).text, /saved task/);
  assert.equal(f.memory.listTasks()[0].text, 'study Express.js');
  assert.equal(f.modelCalls, 0);
});

test('natural completion, deletion approval and audit are deterministic', async t => {
  const f = await assistantFixture(t);
  const added = await f.controller.answer('Please add a task called revise number systems');
  assert.match(added.text, /Added task/);
  const task = f.memory.listTasks()[0];
  assert.match((await f.controller.answer('mark revise number systems done')).text, /Completed task/);
  assert.equal(f.memory.listTasks()[0].done, true);
  const proposal = await f.controller.answer(`Delete task ${task.id}`);
  assert.match(proposal.text, /Approval needed/);
  assert.equal(f.memory.listTasks().length, 1);
  const id = f.journal.list()[0].id;
  await f.controller.answer(`/reject ${id}`);
  assert.equal(f.memory.listTasks().length, 1);
  assert.match((await f.controller.answer('/audit')).text, /rejected/);
  await f.controller.answer(`/task delete ${task.id}`);
  const deletion = f.journal.list()[0].id;
  assert.match((await f.controller.answer(`/approve ${deletion}`)).text, /task removed/);
  assert.equal(f.memory.listTasks().length, 0);
});

test('no fabricated external action and false-positive instruction routing', async t => {
  const f = await assistantFixture(t);
  const result = await f.controller.answer('Email my teacher the homework');
  assert.match(result.text, /Nothing was sent/);
  assert.equal(f.modelCalls, 0);
  assert.equal(parseIntent('Explain how to add a task'), null);
  assert.equal(parseIntent('Could you please add networking revision to my tasks?')?.type, 'addTask');
});

test('three-operand binary arithmetic runs exact operations', () => {
  const result = calculateText('29+76+19 step by step calculation in binary');
  assert.match(result, /124 \(decimal\)/);
  assert.match(result, /1111100₂ = 124₁₀/);
  assert.doesNotMatch(result, /10011112/);
});

test('spoken tasks require a second explicit confirmation and support cancellation', async t => {
  const f = await assistantFixture(t);
  let utterance = 'Add a task to review networking';
  const voice = {
    requireInput: async () => {},
    requireOutput: async () => {},
    listen: async () => utterance,
    status: () => 'test',
  };
  f.controller.voice = voice;
  let result = await f.controller.answer('/voice ask 5');
  assert.match(result.text, /Nothing has been saved yet/);
  assert.equal(f.memory.listTasks().length, 0);
  utterance = 'confirm';
  result = await f.controller.answer('/voice ask 5');
  assert.match(result.text, /Added task/);
  assert.equal(f.memory.listTasks().length, 1);
  utterance = 'Remember that I am working on Echo';
  await f.controller.answer('/voice ask 5');
  utterance = 'cancel';
  assert.match((await f.controller.answer('/voice ask 5')).text, /Cancelled/);
  assert.equal(f.memory.listNotes().length, 0);
});

test('Echo wake name can prefix safe natural commands; repeated request does not duplicate', async t => {
  const f = await assistantFixture(t);
  assert.match((await f.controller.answer('Hey Echo, add networking practice to my to-do list')).text, /Added task/);
  assert.match((await f.controller.answer('Echo, add networking practice to my to-do list')).text, /No duplicate created/);
  assert.equal(f.memory.listTasks().length, 1);
  assert.match((await f.controller.answer('Echo, I just completed networking practice')).text, /Completed task/);
  assert.equal(f.memory.listTasks()[0].done, true);
});
