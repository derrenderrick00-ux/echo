import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIntent } from '../src/core/intent.js';

test('explicit natural-language memory request is routed before the LLM', () => {
  assert.deepEqual(parseIntent('Remember that I am learning Express.js'),
    { type: 'remember', text: 'I am learning Express.js' });
  assert.deepEqual(parseIntent('My study method is state, explain, example; add that to memory'),
    { type: 'remember', text: 'My study method is state, explain, example' });
});

test('ambiguous memory reference is rejected for clarification', () => {
  assert.deepEqual(parseIntent('add that to memory'), { type: 'clarifyMemory' });
  assert.equal(parseIntent('I want to add some improvements later'), null);
});

test('task completion and built-in capabilities have deterministic routes', () => {
  assert.deepEqual(parseIntent('I have completed networking revision'),
    { type: 'completeTask', reference: 'networking revision' });
  assert.deepEqual(parseIntent('what can you do?'), { type: 'capabilities' });
  assert.deepEqual(parseIntent('convert 980 to binary'), { type: 'math', result: '980 in binary is 1111010100.' });
});

test('generic messages remain normal chat', () => {
  assert.equal(parseIntent('Explain routing protocols'), null);
  assert.equal(parseIntent('What did I ask you to remember?'), null);
});
