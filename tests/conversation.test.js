import test from 'node:test';
import assert from 'node:assert/strict';
import { ConversationSession } from '../src/core/conversation.js';

test('conversation supplies profile and recent turns in correct order', async () => {
  const calls = [];
  const session = new ConversationSession({
    profile: { displayName: 'Sample' }, maxTurns: 2,
    provider: { chat: async messages => { calls.push(messages); return 'OK'; } },
  });
  await session.reply('first');
  await session.reply('second');
  assert.match(calls[0][0].content, /Sample/);
  assert.deepEqual(calls[1].slice(1).map(m => m.role), ['user', 'assistant', 'user']);
  assert.equal(session.history.length, 4);
  await session.reply('third');
  assert.equal(session.history.length, 4);
  assert.equal(session.history[0].content, 'second');
});

test('reset clears session-only history', async () => {
  const session = new ConversationSession({ provider: { chat: async () => 'OK' } });
  await session.reply('Hi');
  session.reset();
  assert.deepEqual(session.history, []);
});

test('failed model call does not get added to history', async () => {
  const session = new ConversationSession({ provider: { chat: async () => { throw new Error('offline'); } } });
  await assert.rejects(session.reply('Hi'), /offline/);
  assert.deepEqual(session.history, []);
});

test('explicit stored note appears as context; model is instructed not to invent memory', async () => {
  let payload;
  const session = new ConversationSession({
    provider: { chat: async messages => { payload = messages; return 'Noted'; } },
    memory: { searchNotes: async () => ({ results: [{ id: 'n1', text: 'Practice Express.js' }] }) },
  });
  await session.reply('What should I practice?');
  assert.match(payload[1].content, /Practice Express.js/);
  assert.match(payload[0].content, /Echo, an AI assistant/);
  assert.match(payload[0].content, /Notes are saved only by \/remember/);
});

test('context includes the exact latest technology mention', async () => {
  const calls = [];
  const session = new ConversationSession({ provider: { chat: async m => { calls.push(m); return 'OK'; } } });
  await session.reply("I'm learning Express.js");
  await session.reply('Which technology did I just mention?');
  assert.equal(calls[1].at(-3).content, "I'm learning Express.js");
});

test('user asking what Echo remembers sees recent notes even without matching keywords', async () => {
  let payload;
  const session = new ConversationSession({
    provider: { chat: async messages => { payload = messages; return 'You saved a note.'; } },
    memory: {
      searchNotes: async () => ({ results: [] }),
      listNotes: () => [{ id: '77', text: 'Revise Express.js routes' }],
    },
  });
  await session.reply('What did I ask you to remember?');
  assert.match(payload[1].content, /Revise Express.js routes/);
});
