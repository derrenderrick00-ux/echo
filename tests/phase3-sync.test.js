import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ActionJournal } from '../src/core/action-journal.js';
import { MemoryStore } from '../src/memory/store.js';
import { ManualSync } from '../src/core/phase3-sync.js';
import { Phase3Commands } from '../src/core/phase3-commands.js';

async function device(t, name) {
  const dir = await mkdtemp(join(tmpdir(), `echo-p3-${name}-`));
  t.after(async () => rm(dir, { recursive: true, force: true }));
  const memory = await new MemoryStore({ filePath: join(dir, 'memory.json') }).init();
  const sync = await new ManualSync({ directory: join(dir, 'sync'), memory }).init();
  const journal = await new ActionJournal({ filePath: join(dir, 'actions.json') }).init();
  const commands = new Phase3Commands({ memory, sync, journal });
  return { dir, memory, sync, journal, commands };
}

async function pair(a, b) {
  await a.commands.handle('/device init');
  await b.commands.handle('/device init');
  await copyFile(b.sync.publicPath, join(a.sync.inbox, 'peer.pem'));
  await copyFile(a.sync.publicPath, join(b.sync.inbox, 'peer.pem'));
  const actionA = await a.commands.handle('/device trust peer.pem');
  const actionB = await b.commands.handle('/device trust peer.pem');
  assert.match(actionA.text, new RegExp(b.sync.id));
  assert.match(actionB.text, new RegExp(a.sync.id));
  assert.equal(a.sync.peersList().length, 0);
  await a.commands.handle(`/approve ${a.journal.list()[0].id}`);
  await b.commands.handle(`/approve ${b.journal.list()[0].id}`);
}

test('sync identities are unique, private keys stay in device folder, and trust needs approval', async t => {
  const a = await device(t, 'a');
  const b = await device(t, 'b');
  await pair(a,b);
  assert.notEqual(a.sync.id, b.sync.id);
  assert.equal(a.sync.peersList()[0], b.sync.id);
  const privateKey = await readFile(a.sync.privatePath, 'utf8');
  assert.match(privateKey, /PRIVATE KEY/);
  const pub = await readFile(a.sync.publicPath, 'utf8');
  assert.doesNotMatch(pub, /PRIVATE KEY/);
  assert.equal((await a.commands.handle('/sync status')).text.includes('No internet'), false);
});

test('two devices can transfer authenticated ciphertext without network and import only after approval', async t => {
  const a = await device(t, 'a');
  const b = await device(t, 'b');
  await pair(a,b);
  await a.memory.addNote('The networking revision is complete');
  await a.memory.addTask('Learn SQLite and Node.js');
  const exportResult = await a.sync.exportSnapshot(b.sync.id);
  const envelope = await readFile(exportResult.target, 'utf8');
  assert.doesNotMatch(envelope, /networking revision|Learn SQLite/);
  await copyFile(exportResult.target, join(b.sync.inbox, exportResult.filename));
  const preview = await b.commands.handle(`/sync preview ${exportResult.filename}`);
  assert.match(preview.text, /1 new notes, 1 new tasks/);
  assert.equal(b.memory.listNotes().length, 0);
  const staged = await b.commands.handle(`/sync import ${exportResult.filename}`);
  assert.match(staged.text, /Approval needed/);
  assert.equal(b.memory.listTasks().length, 0);
  const approval = b.journal.list()[0].id;
  assert.match((await b.commands.handle(`/approve ${approval}`)).text, /imported 1 notes and 1 tasks/);
  assert.equal(b.memory.listNotes()[0].text, 'The networking revision is complete');
  assert.equal(b.memory.listTasks()[0].text, 'Learn SQLite and Node.js');
  const stagedAgain = await b.commands.handle(`/sync import ${exportResult.filename}`);
  assert.match(stagedAgain.text, /0 new notes, 0 new tasks/);
});

test('tampering with snapshot ciphertext prevents import', async t => {
  const a = await device(t, 'a');
  const b = await device(t, 'b');
  await pair(a,b);
  await a.memory.addTask('Read a novel');
  const output = await a.sync.exportSnapshot(b.sync.id);
  const path = join(b.sync.inbox, output.filename);
  const env = JSON.parse(await readFile(output.target, 'utf8'));
  const bytes = Buffer.from(env.ciphertext, 'base64');
  bytes[0] ^= 1;
  env.ciphertext = bytes.toString('base64');
  await writeFile(path, JSON.stringify(env));
  await assert.rejects(b.sync.decryptInbox(output.filename), /authenticate|Unsupported|Invalid/i);
  assert.equal(b.memory.listTasks().length, 0);
});

test('conflicting same-ID records never overwrite local data', async t => {
  const a = await device(t, 'a');
  const b = await device(t, 'b');
  await pair(a,b);
  const task = await a.memory.addTask('Learn SQL');
  b.memory.data.tasks.push({ ...task, text: 'Different task' });
  await b.memory.save();
  const out = await a.sync.exportSnapshot(b.sync.id);
  await copyFile(out.target, join(b.sync.inbox, out.filename));
  assert.match((await b.commands.handle(`/sync preview ${out.filename}`)).text, /1 conflicting records/);
  assert.match((await b.commands.handle(`/sync import ${out.filename}`)).text, /Import denied/);
  assert.equal(b.memory.listTasks()[0].text, 'Different task');
});

test('approval of changed ciphertext is refused and payload path traversal is blocked', async t => {
  const a = await device(t, 'a');
  const b = await device(t, 'b');
  await pair(a,b);
  await a.memory.addNote('Secure record');
  const out = await a.sync.exportSnapshot(b.sync.id);
  const local = join(b.sync.inbox, out.filename);
  await copyFile(out.target, local);
  await b.commands.handle(`/sync import ${out.filename}`);
  const id = b.journal.list()[0].id;
  const data = JSON.parse(await readFile(local, 'utf8'));
  data.iv = Buffer.alloc(12).toString('base64');
  await writeFile(local, JSON.stringify(data));
  await assert.rejects(b.commands.handle(`/approve ${id}`));
  assert.equal(b.memory.listNotes().length, 0);
  await assert.rejects(b.sync.decryptInbox('../secrets.echosync'), /simple/);
});

test('pending action expires and is never executed after deadline', async t => {
  const f = await device(t, 'expire');
  let now = Date.parse('2026-10-26T10:00:00Z');
  f.journal.clock = () => new Date(now);
  await f.memory.addNote('Private note');
  const id = f.memory.listNotes()[0].id;
  await f.commands.handle(`/note delete ${id}`);
  now += 16 * 60 * 1000;
  const actionId = f.journal.list()[0].id;
  assert.match((await f.commands.handle(`/approve ${actionId}`)).text, /expired/);
  assert.equal(f.memory.listNotes().length, 1);
});
