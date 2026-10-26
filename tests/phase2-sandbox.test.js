import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { CodeSandbox, sandboxArgs } from '../src/tools/sandbox.js';

async function workspace(action) {
  const dir = await mkdtemp(join(tmpdir(), 'echo-js-sandbox-'));
  const root = join(dir, 'source');
  await mkdir(root);
  await writeFile(join(root, 'demo.js'), 'console.log(2 + 3);');
  try { await action({ dir, root }); }
  finally { await rm(dir, { recursive: true, force: true }); }
}

function fakeSpawn(command, args, options) {
  assert.equal(command, 'bwrap');
  assert.equal(options.stdio[0], 'ignore');
  assert.ok(args.includes('--unshare-all'));
  assert.ok(args.includes('--clearenv'));
  assert.ok(args.includes('--new-session'));
  const child = new EventEmitter();
  child.pid = 9999999;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => {};
  queueMicrotask(() => { child.stdout.end('5\n'); child.stderr.end(); child.emit('close', 0, null); });
  return child;
}

test('sandbox file source is limited to its private JS workspace', async () => {
  await workspace(async ({ root }) => {
    const runner = await new CodeSandbox({ workspaceDir: root }).init();
    assert.equal((await runner.source('demo.js')).content, 'console.log(2 + 3);');
    await assert.rejects(runner.source('../secrets.js'), /workspace/);
    await assert.rejects(runner.source('/etc/passwd'), /workspace/);
    await assert.rejects(runner.source('demo.txt'), /workspace/);
    assert.equal((await runner.listFiles()).length, 1);
  });
});

test('symlink pointing outside workspace is rejected', async () => {
  await workspace(async ({ root, dir }) => {
    await writeFile(join(dir, 'private.js'), 'console.log(process.env);');
    await symlink(join(dir, 'private.js'), join(root, 'escape.js'));
    const runner = await new CodeSandbox({ workspaceDir: root }).init();
    await assert.rejects(runner.source('escape.js'), /Symbolic links/);
  });
});

test('missing bubblewrap fails closed and does not execute user code', async () => {
  await workspace(async ({ root }) => {
    let invoked = false;
    const runner = await new CodeSandbox({ workspaceDir: root, enabled: true, probe: () => ({ status: 127 }), runner: () => { invoked = true; } }).init();
    assert.equal(runner.inspect().ready, false);
    await assert.rejects(runner.run('demo.js'), /Install with/);
    assert.equal(invoked, false);
  });
});

test('sandbox executes only through bubblewrap with no shell', async () => {
  await workspace(async ({ root }) => {
    const runner = await new CodeSandbox({ workspaceDir: root, enabled: true, probe: () => ({ status: 0 }), runner: fakeSpawn }).init();
    const result = await runner.run('demo.js');
    assert.deepEqual(result, { exitCode: 0, signal: null, stdout: '5\n', stderr: '', isolated: true });
  });
});

test('sandbox args restrict filesystem and network and bound Node memory', async () => {
  await workspace(async ({ root }) => {
    const args = sandboxArgs({ sourceFile: join(root, 'demo.js') });
    assert.ok(args.includes('--unshare-all'));
    assert.ok(args.includes('--die-with-parent'));
    assert.ok(args.includes('--tmpfs'));
    assert.ok(args.includes('--max-old-space-size=64'));
    assert.ok(args.includes('--no-addons'));
    assert.ok(!args.includes('--share-net'));
    assert.ok(!args.includes('--bind'));
  });
});

test('oversized source is rejected before running', async () => {
  await workspace(async ({ root }) => {
    await writeFile(join(root, 'large.js'), 'x'.repeat(17000));
    const runner = await new CodeSandbox({ workspaceDir: root }).init();
    await assert.rejects(runner.run('large.js'), /16 KiB/);
  });
});


test('experimental execution is disabled by default even if bubblewrap exists', async () => {
  await workspace(async ({ root }) => {
    let invoked = false;
    const runner = await new CodeSandbox({ workspaceDir: root, probe: () => ({ status: 0 }), runner: () => { invoked = true; } }).init();
    assert.equal(runner.inspect().ready, false);
    await assert.rejects(runner.run('demo.js'), /OFF/);
    assert.equal(invoked, false);
  });
});
