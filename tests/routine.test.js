import test from 'node:test';
import assert from 'node:assert/strict';
import { routineSummary } from '../src/core/routine.js';

test('on-demand routine includes tasks and current focus but no invented schedule', () => {
  const memory = { listTasks: ({ includeDone } = {}) => includeDone === false
    ? [{ id: '123', text: 'Study Express.js', done: false }] : [{ id: '123', text: 'Study Express.js', done: false }] };
  const output = routineSummary({ profile: { currentFocus: 'Backend development', goals: ['Learn JavaScript'] }, memory,
    now: new Date('2026-10-25T09:00:00Z') });
  assert.match(output, /Sunday, 25 October 2026/);
  assert.match(output, /Backend development/);
  assert.match(output, /Study Express.js/);
  assert.match(output, /not a synced calendar/);
});
