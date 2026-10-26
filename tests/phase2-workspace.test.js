import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Phase2Workspace, parseIdeaLine, ideaScore } from '../src/core/phase2-workspace.js';

async function withStore(action) {
  const dir = await mkdtemp(join(tmpdir(), 'echo-phase2-'));
  const path = join(dir, 'phase2.json');
  try { return await action({ store: await new Phase2Workspace({ filePath: path }).init(), path, dir }); }
  finally { await rm(dir, { recursive: true, force: true }); }
}

test('subjective idea scoring is reproducible with favorable lower effort', () => {
  assert.equal(ideaScore({ impact: 5, learning: 5, feasibility: 5, effort: 1 }), 100);
  assert.ok(ideaScore({ impact: 3, learning: 4, feasibility: 2, effort: 2 }) > ideaScore({ impact: 3, learning: 4, feasibility: 2, effort: 5 }));
  assert.deepEqual(parseIdeaLine('Study tool | feasibility=4 | learning=5 | effort=2 | impact=3'), {
    name: 'Study tool', feasibility: 4, learning: 5, effort: 2, impact: 3,
  });
});

test('idea form rejects missing, duplicate and out-of-range ratings', () => {
  assert.throws(() => parseIdeaLine('Tool | impact=4 | learning=4 | feasibility=3'), /Usage/);
  assert.throws(() => parseIdeaLine('Tool | impact=4 | impact=4 | feasibility=3 | effort=1'), /Duplicate/);
  assert.throws(() => parseIdeaLine('Tool | impact=4 | learning=0 | feasibility=3 | effort=1'), /Ratings/);
});

test('private ideas and decisions persist across fresh store instances', async () => {
  await withStore(async ({ store, path }) => {
    const idea = await store.addIdea({ name: 'Offline study tracker', impact: 5, learning: 4, feasibility: 4, effort: 2 });
    const decision = await store.addDecision({ question: 'Use SQL?', choice: 'SQLite', reason: 'Local offline storage' });
    await store.recordOutcome(decision.id, 'Prototype worked offline');
    const again = await new Phase2Workspace({ filePath: path }).init();
    assert.equal(again.listIdeas()[0].id, idea.id);
    assert.equal(again.listDecisions()[0].outcome, 'Prototype worked offline');
    assert.match(JSON.stringify(again.findDecisions('SQLite')), /SQLite/);
    const permission = await stat(path);
    assert.equal(permission.mode & 0o777, 0o600);
  });
});

test('private preferences persist and become short conversation context', async () => {
  await withStore(async ({ store, path }) => {
    await store.setPreference('accuracy_priority', 'Verify facts and admit uncertainty');
    await store.setPreference('study_method', 'State, define, explain, examples, exercises');
    const again = await new Phase2Workspace({ filePath: path }).init();
    assert.match(again.promptContext(), /accuracy_priority/);
    assert.match(again.promptContext(), /Verify facts/);
    assert.doesNotMatch(again.promptContext(), /SQLite/);
    await again.clearPreference('study_method');
    assert.ok(!('study_method' in again.getPreferences()));
  });
});

test('preferences accept only supported names and valid content', async () => {
  await withStore(async ({ store }) => {
    await assert.rejects(() => store.setPreference('password', 'secret'), /Unsupported/);
    await assert.rejects(() => store.setPreference('accuracy_priority', ' '.repeat(8)), /printable/);
    await assert.rejects(() => store.recordOutcome('deadbeef', 'works'), /not found/);
  });
});

test('corrupted workspace is rejected without overwrite', async () => {
  await withStore(async ({ path, store }) => {
    await store.addIdea({ name: 'X', impact: 1, learning: 1, feasibility: 1, effort: 5 });
    await writeFile(path, '{oops');
    await assert.rejects(new Phase2Workspace({ filePath: path }).init(), /malformed JSON/);
    assert.equal(await readFile(path, 'utf8'), '{oops');
  });
});

test('workspace rejects malformed record schemas', async () => {
  await withStore(async ({ path }) => {
    await writeFile(path, JSON.stringify({ version: 1, ideas: [{ id: 'aabbccdd', name: 'X', impact: 99, learning: 3, feasibility: 2, effort: 1, createdAt: '2026' }], decisions: [], preferences: {} }));
    await assert.rejects(new Phase2Workspace({ filePath: path }).init(), /impact must/);
  });
});
