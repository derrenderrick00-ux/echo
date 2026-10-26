import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Phase2Workspace } from '../src/core/phase2-workspace.js';
import { Phase2Commands } from '../src/core/phase2-commands.js';
import { CodeSandbox } from '../src/tools/sandbox.js';
import { ConversationSession } from '../src/core/conversation.js';
import { AssistantController } from '../src/core/assistant.js';

async function withCommands(action) {
  const dir = await mkdtemp(join(tmpdir(), 'echo-p2-command-'));
  const store = await new Phase2Workspace({ filePath: join(dir, 'p2.json') }).init();
  const sandbox = await new CodeSandbox({ workspaceDir: join(dir, 'code') }).init();
  try { await action({ dir, store, sandbox, commands: new Phase2Commands({ workspace: store, sandbox }) }); }
  finally { await rm(dir, { recursive: true, force: true }); }
}

test('ideas can be saved, listed and ranked without model calls', async () => {
  await withCommands(async ({ commands }) => {
    const added = await commands.handle('/idea add Echo tracker | impact=5 | learning=5 | feasibility=3 | effort=4');
    assert.match(added.text, /Saved idea/);
    assert.match((await commands.handle('/idea rank')).text, /Echo tracker/);
  });
});

test('decision journal records outcomes and finds them', async () => {
  await withCommands(async ({ commands, store }) => {
    await commands.handle('/decision add SQLite or PostgreSQL? | SQLite | Good for offline use');
    const id = store.listDecisions()[0].id;
    assert.match((await commands.handle(`/decision outcome ${id} | Worked for prototype`)).text, /Recorded/);
    assert.match((await commands.handle('/decision find prototype')).text, /Worked for prototype/);
  });
});

test('explicit private preference is readable but not trained into model weights', async () => {
  await withCommands(async ({ commands }) => {
    assert.match((await commands.handle('/preference set accuracy_priority | Use calculations rather than guesses')).text, /does not retrain/);
    assert.match((await commands.handle('/preference list')).text, /Use calculations/);
    assert.match((await commands.handle('/preference clear accuracy_priority')).text, /Cleared/);
  });
});

test('model prompts for code and ideas only propose changes and do not execute', async () => {
  await withCommands(async ({ commands, sandbox }) => {
    await writeFile(join(sandbox.workspaceDir, 'hello.js'), 'console.log("hello");');
    for (const [command, phrase] of [
      ['/code generate build a JSON parser', 'Never execute generated code'],
      ['/code explain hello.js', 'Do not execute it'],
      ['/code review hello.js', 'Do not claim tests were run'],
      ['/idea brainstorm offline communication', 'Do not save or execute anything'],
    ]) assert.match((await commands.handle(command)).askModel, new RegExp(phrase));
  });
});

test('assistant passes Phase 2 commands to local structured tools without LLM', async () => {
  await withCommands(async ({ commands, store, sandbox }) => {
    let calls = 0;
    const provider = { chat: async () => { calls++; return 'Model response'; } };
    const session = new ConversationSession({ provider });
    session.contextProvider = () => store.promptContext();
    const assistant = new AssistantController({
      session, memory: {}, calendar: {}, profileState: { loaded: false, profile: null },
      model: 'fake', embeddingModel: 'fake', phase2Workspace: store, codeSandbox: sandbox,
    });
    assert.match((await assistant.answer('/idea add Portable app | impact=4 | learning=4 | feasibility=3 | effort=2')).text, /Saved idea/);
    assert.equal(calls, 0);
    await assistant.answer('/preference set response_style | concise');
    assert.match((await assistant.answer('/preference list')).text, /concise/);
    const generated = await assistant.answer('/code generate ping local server');
    assert.equal(generated.text, 'Model response');
    assert.equal(calls, 1);
  });
});

test('LLM context includes explicit user preferences only, not unapproved journal details', async () => {
  await withCommands(async ({ store }) => {
    await store.setPreference('study_method', 'Use diagrams and worked examples');
    await store.addDecision({ question: 'Internal choice', choice: 'A', reason: 'Sensitive reason' });
    const prompts = [];
    const session = new ConversationSession({ provider: { chat: async messages => { prompts.push(messages); return 'OK'; } } });
    session.contextProvider = () => store.promptContext();
    await session.reply('Teach a topic');
    assert.match(JSON.stringify(prompts[0]), /Use diagrams/);
    assert.doesNotMatch(JSON.stringify(prompts[0]), /Sensitive reason/);
  });
});
