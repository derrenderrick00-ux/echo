import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

function runNode(script, cwd, env, input) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [script], { cwd, env });
    let stdout = '', stderr = '';
    child.stdout.on('data', b => { stdout += b; });
    child.stderr.on('data', b => { stderr += b; });
    child.on('error', reject);
    child.on('close', code => resolvePromise({ code, stdout, stderr }));
    child.stdin.end(input);
  });
}

test('CLI end-to-end: note persistence, simulated Ollama streaming, routine', async () => {
  const root = await mkdtemp(join(tmpdir(), 'echo-cli-int-'));
  const script = resolve('src/echo.js');
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (req.url === '/api/embed') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ embeddings: [[1, 0, 0]] }));
      return;
    }
    if (req.url === '/api/chat') {
      res.setHeader('content-type', 'application/x-ndjson');
      res.write(JSON.stringify({ message: { content: 'Hello ' }, done: false }) + '\n');
      res.write(JSON.stringify({ message: { content: 'from Echo' }, done: false }) + '\n');
      res.end(JSON.stringify({ done: true }) + '\n');
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const port = server.address().port;
  const env = { ...process.env, ECHO_OLLAMA_URL: `http://127.0.0.1:${port}` };
  try {
    const first = await runNode(script, root, env,
      '/remember Learning Express.js\n/task add Review JS routes\n/routine\nHi\n/exit\n');
    assert.equal(first.code, 0, first.stderr);
    assert.match(first.stdout, /Hello from Echo/);
    assert.match(first.stdout, /Review JS routes/);
    const saved = JSON.parse(await readFile(join(root, 'data/echo-memory.json'), 'utf8'));
    assert.equal(saved.notes.length, 1);
    assert.equal(saved.notes[0].vector.model, 'all-minilm');
    const second = await runNode(script, root, env, '/notes\n/task list\n/exit\n');
    assert.equal(second.code, 0, second.stderr);
    assert.match(second.stdout, /Learning Express.js/);
    assert.match(second.stdout, /Review JS routes/);
  } finally {
    await new Promise(done => server.close(done));
    await rm(root, { recursive: true, force: true });
  }
});
