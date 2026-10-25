import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadProfile, makeSystemPrompt } from '../src/memory/profile.js';

async function withTempFile(content, fn) {
  const dir = await mkdtemp(join(tmpdir(), 'echo-test-'));
  const file = join(dir, 'profile.json');
  try { await writeFile(file, content); return await fn(file); }
  finally { await rm(dir, { recursive: true, force: true }); }
}

test('missing private profile remains optional', async () => {
  const result = await loadProfile(join(tmpdir(), 'echo-this-file-does-not-exist.json'));
  assert.deepEqual(result, { loaded: false, profile: null });
});

test('valid private profile loads and influences system context', async () => {
  await withTempFile(JSON.stringify({ displayName: 'Sample', goals: ['Learn JS'] }), async file => {
    const result = await loadProfile(file);
    assert.equal(result.loaded, true);
    assert.match(makeSystemPrompt(result.profile), /Learn JS/);
  });
});

test('corrupt profile gets a clear error', async () => {
  await withTempFile('{invalid json', async file => {
    await assert.rejects(loadProfile(file), /invalid JSON/);
  });
});

test('identity instruction distinguishes Derrick from Echo', () => {
  const prompt = makeSystemPrompt({ displayName: 'Derrick' });
  assert.match(prompt, /Derrick is the HUMAN user and creator of Echo/);
  assert.match(prompt, /Echo is the digital assistant, NOT Derrick/);
});
