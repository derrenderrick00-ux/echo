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
