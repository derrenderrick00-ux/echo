import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const entry = resolve('src/echo.js');

function waitFor(read, predicate, timeout = 6000) {
  return new Promise((resolvePromise, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(new Error('CLI timed out waiting for response')), timeout);
    function finish(error, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      read.listeners.delete(check);
      if (error) reject(error);
      else resolvePromise(value);
    }
    function check() {
      const value = predicate(read.text);
      if (value) finish(null, value);
    }
    read.listeners.add(check);
    check();
  });
}

test('multiline pasted code is staged and only saved after approval, never sent to model', async t => {
  const root = await mkdtemp(join(tmpdir(), 'echo-cli-file-'));
  t.after(async () => rm(root, { recursive: true, force: true }));
  const child = spawn(process.execPath, [entry], { cwd: root, env: { ...process.env, ECHO_OLLAMA_MODEL: 'llama3.2:1b', ECHO_WHISPER_MODEL: '', ECHO_PIPER_MODEL: '' }, stdio: ['pipe', 'pipe', 'pipe'] });
  t.after(() => { if (!child.killed) child.kill(); });
  const read = { text: '', listeners: new Set() };
  child.stdout.on('data', chunk => { read.text += chunk.toString(); for (const f of [...read.listeners]) f(); });
  child.stderr.on('data', chunk => { read.text += chunk.toString(); for (const f of [...read.listeners]) f(); });
  await waitFor(read, out => out.includes('Private file creation') && out.includes('you>'));
  child.stdin.write('/file paste new/demo.js\n');
  child.stdin.write('const value = 42;\n');
  child.stdin.write('console.log(value);\n');
  child.stdin.write(':end\n');
  const match = await waitFor(read, out => out.match(/Draft \[([0-9a-f]{10})\]/));
  await assert.rejects(readFile(join(root, 'data/code-workspace/new/demo.js'), 'utf8'), /ENOENT/);
  child.stdin.write(`/file save ${match[1]}\n`);
  await waitFor(read, out => out.includes('Created 1 private file(s)'));
  assert.equal(await readFile(join(root, 'data/code-workspace/new/demo.js'), 'utf8'), 'const value = 42;\nconsole.log(value);\n');
  child.stdin.write('/exit\n');
  child.stdin.end();
  const exit = await new Promise((resolvePromise, reject) => { child.once('close', resolvePromise); child.once('error', reject); });
  assert.equal(exit, 0, read.text);
});
