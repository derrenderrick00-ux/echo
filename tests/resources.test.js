import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMemoryInfo, resourceSummary } from '../src/core/resources.js';

const memory = 'MemTotal:        7340032 kB\nMemAvailable:    785408 kB\nSwapTotal:       4194304 kB\nSwapFree:        3665920 kB\n';

test('Linux MemAvailable is measured correctly rather than confusing it with MemFree', () => {
  const info = parseMemoryInfo(memory);
  assert.equal(info.MemTotal, 7 * 1024 ** 3);
  assert.equal(info.MemAvailable, 785408 * 1024);
});

test('low available memory yields a warning, not an unsupported GPU claim', async () => {
  const text = await resourceSummary({ read: async () => memory });
  assert.match(text, /less than 1 GiB available/);
  assert.match(text, /Swap used:/);
  assert.doesNotMatch(text, /must buy/);
});

test('memory parser rejects incomplete reports', () => assert.throws(() => parseMemoryInfo('MemFree: 99 kB'), /Cannot parse/));
