import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm, symlink, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileWorkspace, cleanFilename, extractCodeBlock } from '../src/core/file-workspace.js';
import { FileCommands } from '../src/core/file-commands.js';
import { parseFileIntent } from '../src/core/file-intent.js';
import { unitConverterScaffold } from '../src/core/file-scaffolds.js';
import { runInNewContext } from 'node:vm';

async function fixture(t) {
  const base = await mkdtemp(join(tmpdir(), 'echo-files-'));
  t.after(async () => rm(base, { recursive: true, force: true }));
  const files = await new FileWorkspace({ root: join(base, 'workspace') }).init();
  return { files, base, cmd: new FileCommands({ files }) };
}

test('creates files only after explicit approval and refuses overwrites', async t => {
  const f = await fixture(t);
  const response = await f.cmd.handle('/file create src/app.js | console.log(2);');
  assert.match(response.text, /NOTHING WRITTEN/);
  assert.deepEqual(await f.files.list(), []);
  const id = response.text.match(/Draft \[([0-9a-f]{10})\]/)[1];
  assert.match((await f.cmd.handle(`/file preview ${id}`)).text, /console.log\(2\)/);
  assert.match((await f.cmd.handle(`/file save ${id}`)).text, /Created 1 private file/);
  assert.equal(await f.files.read('src/app.js'), 'console.log(2);');
  assert.deepEqual(await f.files.list(), ['src/app.js']);
  await assert.rejects(f.files.stage([{ name: 'src/app.js', content: 'console.log(3)' }]), /already exists/);
  await assert.rejects(f.cmd.handle(`/file save ${id}`), /not found/);
  if (process.platform !== 'win32') assert.equal((await lstat(join(f.base, 'workspace/src/app.js'))).mode & 0o777, 0o600);
});

test('invalid javascript or JSON is rejected before approval', async t => {
  const f = await fixture(t);
  await assert.rejects(f.files.stage([{ name: 'bad.js', content: 'const a = ;' }]), /invalid JavaScript/);
  await assert.rejects(f.files.stage([{ name: 'bad.json', content: '{bad' }]), /invalid JSON/);
  assert.deepEqual(await f.files.list(), []);
});

test('rejects traversals, absolute paths, restricted extensions and duplicate case-insensitive draft files', async t => {
  const f = await fixture(t);
  for (const bad of ['../x.js', '/tmp/x.js', 'folder/../../y.js', 'folder\\x.js', '.env', 'secrets.key', 'a/b/c/d.js', 'a//b.js']) assert.throws(() => cleanFilename(bad));
  await assert.rejects(f.files.stage([{ name: 'test.js', content: 'const x = 1' }, { name: 'TEST.JS', content: 'const x = 2' }]), /Duplicate/);
  await assert.rejects(f.files.stage([{ name: 'empty.md', content: '' }]), /nonempty/);
});

test('symlinks cannot redirect writes outside workspace', async t => {
  const f = await fixture(t);
  const outside = join(f.base, 'outside');
  await mkdir(outside);
  await symlink(outside, join(f.base, 'workspace', 'external'));
  await assert.rejects(f.files.stage([{ name: 'external/data.txt', content: 'secret' }]), /symbolic link/);
  const stage = await f.files.stage([{ name: 'project/app.js', content: 'console.log(1)' }]);
  await mkdir(join(f.base, 'workspace', 'project'));
  await symlink(join(outside, 'outside.js'), join(f.base, 'workspace', 'project', 'app.js'));
  await assert.rejects(f.files.save(stage.id), /already exists/);
});

test('file draft is cancelled or expires without side effects', async t => {
  let time = 0;
  const f = await fixture(t);
  const draft = await new FileWorkspace({ root: join(f.base, 'workspace'), clock: () => time }).init();
  const staged = await draft.stage([{ name: 'a.md', content: 'hello' }]);
  time = 15 * 60_000 + 1;
  await assert.rejects(draft.save(staged.id), /expired/);
  assert.deepEqual(await draft.list(), []);
  const next = await f.files.stage([{ name: 'b.md', content: 'ok' }]);
  f.files.cancel(next.id);
  assert.deepEqual(await f.files.list(), []);
});

test('can stage one fenced block from last generated response and validate language syntax', async t => {
  const f = await fixture(t);
  const blocks = 'Example:\n```javascript\nconsole.log(42);\n```\n```css\nbody { color: red; }\n```';
  assert.equal(extractCodeBlock(blocks, 1).count, 2);
  const draft = await f.cmd.fromLast('demo.js', blocks);
  assert.match(draft.text, /2 code blocks/);
  const id = draft.text.match(/Draft \[([0-9a-f]{10})\]/)[1];
  await f.files.save(id);
  assert.equal((await f.files.read('demo.js')).trim(), 'console.log(42);');
  await assert.rejects(f.cmd.fromLast('other.js', 'No code here'), /no fenced code/);
});

test('unit converter scaffold has syntactically valid files and correct unit calculations', async t => {
  const f = await fixture(t);
  const scaffold = unitConverterScaffold();
  assert.equal(scaffold.length, 4);
  const script = scaffold.find(x => x.name.endsWith('converter.js')).content;
  const ctx = {};
  ctx.globalThis = ctx;
  runInNewContext(script, ctx);
  assert.equal(ctx.convertUnit(1, 'length', 'm', 'cm'), 100);
  assert.equal(ctx.convertUnit(1, 'mass', 'kg', 'g'), 1000);
  assert.equal(ctx.convertUnit(0, 'temperature', 'C', 'F'), 32);
  assert.equal(ctx.convertUnit(212, 'temperature', 'F', 'C'), 100);
  assert.throws(() => ctx.convertUnit(-274, 'temperature', 'C', 'K'), /absolute zero/);
  assert.throws(() => ctx.convertUnit(1, 'length', 'bogus', 'cm'), /Unsupported/);
  const proposal = await f.cmd.handle('/project scaffold unit-converter');
  const id = proposal.text.match(/Draft \[([0-9a-f]{10})\]/)[1];
  const written = await f.files.save(id);
  assert.equal(written.length, 4);
  assert.equal((await f.files.list()).length, 4);
  assert.match(await f.files.read('unit-converter/index.html'), /converter-form/);
});

test('natural file requests are recognized but not confused with ordinary chat or tasks', () => {
  assert.equal(parseFileIntent('create a file named ideas.md containing hello').type, 'createFile');
  assert.deepEqual(parseFileIntent('Echo create a file called hello.js with console.log(1)'), { type: 'createFile', name: 'hello.js', content: 'console.log(1)' });
  assert.equal(parseFileIntent('create a unit converter using html css and js').type, 'scaffoldConverter');
  assert.equal(parseFileIntent('generate code for a unit converter using JS HTML CSS').type, 'scaffoldConverter');
  assert.equal(parseFileIntent('save the code as test.js').type, 'saveLastCode');
  assert.equal(parseFileIntent('add networking revision to my tasks'), null);
  assert.equal(parseFileIntent('explain code syntax'), null);
});

test('verified physics constants and Windows account capabilities reject factual confusions from live logs', async () => {
  const { verifiedFact } = await import('../src/core/verified-facts.js');
  assert.match(verifiedFact('Planck constant is 3.0 * 10^8'), /6\.62607015/);
  assert.match(verifiedFact('Planck constant is 3.0 * 10^8'), /299,792,458/);
  assert.match(verifiedFact('Windows is not single-user'), /multiple user accounts/);
  assert.equal(verifiedFact('teach me networking'), null);
});

test('generates a single model-produced file as an uncommitted draft and rejects invalid source', async t => {
  const f = await fixture(t);
  const { AssistantController } = await import('../src/core/assistant.js');
  const makeController = answer => new AssistantController({
    session: { provider: {}, reply: async () => answer },
    memory: { listNotes: () => [], listTasks: () => [] },
    calendar: { list: () => [] },
    profileState: { loaded: false, profile: null },
    model: 'mock', embeddingModel: 'mock', fileWorkspace: f.files
  });
  const c = makeController('```javascript\nconsole.log("Hello");\n```');
  const result = await c.answer('/file generate hello.js | print Hello');
  assert.match(result.text, /Generated draft from the local LLM/);
  assert.deepEqual(await f.files.list(), []);
  const id = result.text.match(/Draft \[([0-9a-f]{10})\]/)[1];
  assert.match((await c.answer(`/file save ${id}`)).text, /Created 1 private file/);
  assert.equal((await f.files.read('hello.js')).trim(), 'console.log("Hello");');
  const invalid = makeController('```javascript\nconst broken = ;\n```');
  await assert.rejects(invalid.answer('/file generate bad.js | break syntax'), /invalid JavaScript/);
  assert.deepEqual(await f.files.list(), ['hello.js']);
  assert.deepEqual(parseFileIntent('create a JavaScript file named demo.js that prints hello'), { type: 'generateFile', name: 'demo.js', requirement: 'prints hello' });
});

test('natural file creation stages a real proposal without Ollama or immediate write', async t => {
  const f = await fixture(t);
  const { AssistantController } = await import('../src/core/assistant.js');
  let calls = 0;
  const c = new AssistantController({
    session: { provider: {}, reply: async () => { calls++; return 'guess'; } },
    memory: { listNotes: () => [], listTasks: () => [] },
    calendar: { list: () => [] },
    profileState: { loaded: false, profile: null },
    model: 'mock', embeddingModel: 'mock', fileWorkspace: f.files
  });
  const result = await c.answer('Echo create a file called todo.md containing Learn MongoDB');
  assert.match(result.text, /NOTHING WRITTEN/);
  assert.equal(calls, 0);
  assert.deepEqual(await f.files.list(), []);
  const id = result.text.match(/Draft \[([0-9a-f]{10})\]/)[1];
  await c.answer(`/file save ${id}`);
  assert.equal(await f.files.read('todo.md'), 'Learn MongoDB');
});
