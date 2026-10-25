import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MemoryStore } from '../src/memory/store.js';

async function withStore(fn, embedder = null) {
  const folder = await mkdtemp(join(tmpdir(), 'echo-memory-test-'));
  const filePath = join(folder, 'private', 'echo-memory.json');
  try {
    const store = await new MemoryStore({ filePath, embedder, clock: () => new Date('2026-10-25T09:00:00Z') }).init();
    return await fn(store, filePath);
  } finally { await rm(folder, { recursive: true, force: true }); }
}

test('explicit notes survive restart; no chat auto-saving', async () => {
  await withStore(async (store, filePath) => {
    const saved = await store.addNote('I am learning Express.js');
    assert.equal(store.listNotes().length, 1);
    const another = await new MemoryStore({ filePath }).init();
    assert.equal(another.listNotes()[0].text, 'I am learning Express.js');
    assert.equal(another.listNotes()[0].id, saved.note.id);
  });
});

test('semantic search finds related notes without matching words', async () => {
  const embedder = { model: 'fake-embed', embed: async text =>
    /database|sql|storage/.test(text.toLowerCase()) ? [1, 0] : [0, 1] };
  await withStore(async store => {
    await store.addNote('Study PostgreSQL storage engines');
    await store.addNote('Learn guitar chords');
    const result = await store.searchNotes('database design');
    assert.equal(result.mode, 'semantic + keyword');
    assert.match(result.results[0].text, /PostgreSQL/);
  }, embedder);
});

test('notes save even if embedding model is missing; keyword fallback works', async () => {
  const broken = { model: 'missing', embed: async () => { throw new Error('missing'); } };
  await withStore(async store => {
    const saved = await store.addNote('Practice Express.js routes');
    assert.equal(saved.indexed, false);
    const result = await store.searchNotes('Express.js');
    assert.equal(result.mode, 'keyword');
    assert.equal(result.results.length, 1);
    assert.deepEqual(await store.indexNotes(), { indexed: 0, failed: 1 });
  }, broken);
});

test('forget permanently deletes one note', async () => {
  await withStore(async (store, filePath) => {
    const { note } = await store.addNote('Secret project idea');
    assert.equal(await store.deleteNote(note.id), true);
    assert.equal(await store.deleteNote(note.id), false);
    const reopened = await new MemoryStore({ filePath }).init();
    assert.equal(reopened.listNotes().length, 0);
  });
});

test('tasks survive restart and completion changes their state', async () => {
  await withStore(async (store, filePath) => {
    const task = await store.addTask('Revise networking for 30 minutes');
    assert.equal(await store.completeTask(task.id), true);
    const reopened = await new MemoryStore({ filePath }).init();
    assert.equal(reopened.listTasks()[0].done, true);
  });
});

test('invalid JSON memory is not silently overwritten', async () => {
  await withStore(async (store, filePath) => {
    await store.addNote('important data');
    await writeFile(filePath, '{bad');
    await assert.rejects(new MemoryStore({ filePath }).init(), /invalid JSON/);
    assert.equal(await readFile(filePath, 'utf8'), '{bad');
  });
});

test('memory is restricted to user access on POSIX', async () => {
  if (process.platform === 'win32') return;
  await withStore(async (store, filePath) => {
    await store.addNote('private entry');
    assert.equal((await stat(filePath)).mode & 0o777, 0o600);
  });
});

test('reject blank or oversized notes and tasks', async () => {
  await withStore(async store => {
    await assert.rejects(store.addNote('  '), /between 1 and 1,500/);
    await assert.rejects(store.addNote('x'.repeat(1501)), /between 1 and 1,500/);
    await assert.rejects(store.addTask('x'.repeat(301)), /between 1 and 300/);
  });
});
