import test from 'node:test';
import assert from 'node:assert/strict';
import { phases } from '../src/phases/index.js';
import { statusText } from '../src/echo.js';

 test('all six phases are registered in order', () => {
   assert.deepEqual(phases.map(phase => phase.id), [0, 1, 2, 3, 4, 5]);
 });

 test('phase 0 complete with phases 1 and 2 under development', () => {
   assert.equal(phases[0].status, 'complete');
   assert.equal(phases[1].status, 'in-progress');
   assert.equal(phases[2].status, 'in-progress');
   assert.ok(phases.slice(3).every(phase => phase.status === 'planned'));
 });

 test('status command mentions phase 0', () => {
   assert.match(statusText(), /Phase 0: Foundation/);
 });
