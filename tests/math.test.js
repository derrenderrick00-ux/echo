import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateText } from '../src/core/math.js';

test('decimal-to-binary conversions use BigInt, not an LLM guess', () => {
  assert.equal(calculateText('980 convert to binary'), '980 in binary is 1111010100.');
  assert.equal(calculateText('convert 1000 to base 2'), '1000 in binary is 1111101000.');
  assert.equal(calculateText('8 to base 2'), '8 in binary is 1000.');
  assert.equal(calculateText('convert 0 to binary'), '0 in binary is 0.');
});

test('basic arithmetic rejects division by zero and handles integers', () => {
  assert.equal(calculateText('1+2'), '1 + 2 = 3');
  assert.equal(calculateText('what is 12 * 7?'), '12 * 7 = 84');
  assert.equal(calculateText('8/0'), 'Division by zero is undefined.');
});

test('unrelated conversation is delegated instead of being guessed as math', () => {
  assert.equal(calculateText('1000'), null);
  assert.equal(calculateText('how are you?'), null);
});
